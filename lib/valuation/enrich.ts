import { computeMeritCoefficient } from './coefficient';
import {
  buildAdjustmentGrid,
  compsSummary,
  reconcile,
  selectComparables,
  weightComparables,
} from './comparables';
import { DEFAULT_MACRO_AREA, type MacroArea } from '@/lib/comps/discount';
import { fitHedonic } from './hedonic';
import { applyBoundedCorrection } from './correction/clamp';
import { DEFAULT_CORRECTION_PARAMS } from './correction/factory';
import { computeConfidence } from './confidence';
import { computeBaseEstimate, condizioniToStato, selectOmiRow } from './omi';
import { computeRange } from './range';
import { boxAutoValue, computeSurface } from './surface';
import { round2 } from './util';
import type { OmiResolver, ComparablesProvider, ZoneIntelligenceProvider, BoundedCorrector } from './ports';
import type {
  AppliedCorrection,
  BreakdownLine,
  CoefficientSet,
  CorrectionParams,
  EnrichResult,
  Estimate,
  SubjectProperty,
  ZoneIntelligence,
} from './types';

/** Sotto questa numerosità di comparabili la stima edonica non si attiva (resta ai fissi). */
const MIN_COMP_FOR_HEDONIC = 4;

/**
 * Orchestratore del motore (async, dipendenze iniettate). NON ha side-effect
 * propri (niente DB/email/HTTP): compone funzioni pure + i port iniettati. La
 * persistenza lead/request e l'invio email avvengono nella API route (M4),
 * mai qui. Un fallimento qui non perde il lead, già committato a monte.
 */

export interface EnrichDeps {
  coefficientSet: CoefficientSet;
  omiResolver: OmiResolver;
  comparablesProvider: ComparablesProvider;
  shrinkageK?: number;
  /** Macro-area per lo sconto offerta→rogito dei comparabili (default Nord-Est). */
  marketArea?: MacroArea;
  /** Fase 3: ricerca web zona (Perplexity). Assente ⇒ stadio saltato. */
  zoneIntelligenceProvider?: ZoneIntelligenceProvider;
  /** Fase 4: correzione LLM vincolata. Assente/disabilitata ⇒ valore deterministico. */
  boundedCorrector?: BoundedCorrector;
  correctionParams?: CorrectionParams;
}

export async function enrich(subject: SubjectProperty, deps: EnrichDeps): Promise<EnrichResult> {
  const { coefficientSet: cs, omiResolver, comparablesProvider } = deps;
  const w = cs.surfaceWeights;
  const m = cs.meritCoefficients;

  // 1. Superficie commerciale.
  const surface = computeSurface(subject, w);

  // 2. Risoluzione zona OMI (port iniettato; possiede la fallback ladder).
  const resolution = await omiResolver.resolve(subject.location, {
    comuneCode: subject.comuneCode ?? null,
  });

  // 3. Stato di conservazione → riga OMI (anti-double-counting).
  const requestedStato = condizioniToStato(subject.condizioni, subject.anniRistrutturazione);
  const rowSel = selectOmiRow(resolution, requestedStato, m);

  // 4. Coefficiente di merito (include lo stateCorrective se si è ripiegato).
  const merit = computeMeritCoefficient(subject, m, rowSel.stateCorrectiveApplied);

  // 5. Stima base OMI + valore a corpo del box.
  const base = computeBaseEstimate(rowSel.row, surface.superficieCommercialeMq, merit.coefficient);
  const omiMid = rowSel.row ? (rowSel.row.comprMin + rowSel.row.comprMax) / 2 : null;
  const boxValue = boxAutoValue(w, omiMid, subject.hasGarage);

  // 6. Comparabili (Fase 1 ⇒ [] ; V2 ⇒ MCA pesato).
  const k = deps.shrinkageK ?? 5;
  const macroArea = deps.marketArea ?? DEFAULT_MACRO_AREA;
  const comps = await selectComparables(subject, comparablesProvider, {
    omiZone: resolution.zonaOmiId,
  });
  const weighted = weightComparables(subject, comps);
  const summary = compsSummary(comps);
  // Stima edonica dei parametri dai comp (Fase 2). Sotto soglia ⇒ undefined ⇒
  // omogeneizzazione coi coefficienti fissi (β=prior ⇒ stesso risultato).
  const hedonicModel = weighted.length >= MIN_COMP_FOR_HEDONIC ? fitHedonic(subject, weighted, m) : undefined;

  // 7. Confidenza (raffinata dai comparabili quando presenti).
  const confidence = computeConfidence({
    fallbackLevel: resolution.fallbackLevel,
    omiRow: rowSel.row,
    subject,
    ...(summary.n > 0 ? { comps: summary } : {}),
  });

  // 8. Range prior OMI accoppiato alla confidenza + riconciliazione MCA.
  const priorEstimate = computeRange(base.baseMin, base.baseMax, boxValue, confidence, m.range);
  const finalEstimate = priorEstimate
    ? reconcile(weighted, priorEstimate, {
        subject,
        merit: m,
        surfaceCommercialeMq: surface.superficieCommercialeMq,
        shrinkageK: k,
        macroArea,
        ...(hedonicModel ? { hedonicModel } : {}),
      })
    : null;

  // 9. Zone intelligence (Fase 3, best-effort: un fallimento non rompe enrich).
  let zoneIntel: ZoneIntelligence | null = null;
  if (deps.zoneIntelligenceProvider && finalEstimate) {
    try {
      zoneIntel = await deps.zoneIntelligenceProvider.research({
        comune: subject.comuneCode ?? null,
        zonaOmiId: resolution.zonaOmiId,
        indirizzo: null,
        location: subject.location,
        omiEurMqMin: rowSel.row?.comprMin ?? null,
        omiEurMqMax: rowSel.row?.comprMax ?? null,
        propertyType: subject.propertyType,
      });
    } catch (err) {
      console.error('[enrich] zone intelligence fallita:', err);
    }
  }

  // 10. Correzione LLM VINCOLATA (Fase 4): il fattore è clampato/applicato da noi.
  const correctionParams = deps.correctionParams ?? DEFAULT_CORRECTION_PARAMS;
  let correctedEstimate: Estimate | null = finalEstimate;
  let appliedCorrection: AppliedCorrection | null = null;
  if (deps.boundedCorrector && finalEstimate && correctionParams.enabled) {
    try {
      const raw = await deps.boundedCorrector.correct({
        estimateDeterministic: finalEstimate,
        zoneIntel,
        dossier: {
          zonaOmiId: resolution.zonaOmiId,
          fallbackLevel: resolution.fallbackLevel,
          confidenceLabel: confidence.label,
          compsCount: summary.n,
        },
        clampMaxPct: correctionParams.clampMaxPct,
      });
      if (raw) {
        const out = applyBoundedCorrection(
          finalEstimate,
          raw,
          correctionParams,
          zoneIntel,
          deps.boundedCorrector.model,
          new Date().toISOString(),
        );
        correctedEstimate = out.estimate;
        appliedCorrection = out.applied;
      }
    } catch (err) {
      console.error('[enrich] correzione LLM fallita:', err);
    }
  }

  // 11. Breakdown voce-per-voce (contributi in € che sommano al point estimate).
  const breakdown = buildBreakdown({
    surface: surface.superficieCommercialeMq,
    omiMid,
    merit,
    rowSel,
    boxValue,
    classe: subject.classeEnergetica,
    semestre: resolution.semestre,
  });
  if (appliedCorrection && finalEstimate && appliedCorrection.factor_applied !== 1) {
    breakdown.push({
      label: `Correzione contesto zona (fattore ${appliedCorrection.factor_applied}${appliedCorrection.clamped ? ', clampato' : ''}) — ${appliedCorrection.motivazione}`,
      contributo: round2((correctedEstimate?.pointEstimate ?? 0) - finalEstimate.pointEstimate),
    });
  }

  return {
    superficie_commerciale_mq: surface.superficieCommercialeMq,
    zona_omi_id: resolution.zonaOmiId,
    fallback_level: resolution.fallbackLevel,
    omi_eur_mq_min: rowSel.row?.comprMin ?? null,
    omi_eur_mq_max: rowSel.row?.comprMax ?? null,
    coefficients_applied: { ...merit.factors, merito_totale: merit.coefficient },
    estimate_min: correctedEstimate?.min ?? null,
    estimate_max: correctedEstimate?.max ?? null,
    confidence,
    breakdown,
    comparables: buildAdjustmentGrid(weighted, { subject, merit: m, macroArea, ...(hedonicModel ? { hedonicModel } : {}) }),
    hedonic: hedonicModel?.summary ?? null,
    zone_intelligence: zoneIntel,
    correction: appliedCorrection,
    estimate_deterministic_min: finalEstimate?.min ?? null,
    estimate_deterministic_max: finalEstimate?.max ?? null,
  };
}

interface BreakdownArgs {
  surface: number;
  omiMid: number | null;
  merit: ReturnType<typeof computeMeritCoefficient>;
  rowSel: ReturnType<typeof selectOmiRow>;
  boxValue: number;
  classe: string | null;
  semestre: string | null;
}

/** Decomposizione moltiplicativa in contributi € che sommano al point estimate. */
function buildBreakdown(a: BreakdownArgs): BreakdownLine[] {
  if (a.omiMid == null || a.rowSel.row == null) {
    return [{ label: 'Quotazione OMI non disponibile — stima non calcolabile su base OMI', contributo: 0 }];
  }

  const lines: BreakdownLine[] = [];
  const fPiano = a.merit.factors['piano'] ?? 1;
  const fClasse = a.merit.factors['classe_energetica'] ?? 1;
  const fLum = a.merit.factors['luminosita_esposizione'] ?? 1;
  const fStato = a.merit.factors['stato_corrective'] ?? 1;

  const v0 = a.omiMid * a.surface;
  const v1 = v0 * fPiano;
  const v2 = v1 * fClasse;
  const v3 = v2 * fLum;
  const v4 = v3 * fStato;

  lines.push({
    label: `Prezzo base zona (OMI ${a.rowSel.row.stato}${a.semestre ? `, ${a.semestre}` : ''}) × ${a.surface} m²`,
    contributo: round2(v0),
  });
  lines.push({ label: `Piano/ascensore (${a.merit.pianoKey})`, contributo: round2(v1 - v0) });
  lines.push({
    label: `Classe energetica ${a.classe ?? 'n/d'}`,
    contributo: round2(v2 - v1),
  });
  if (round2(v3 - v2) !== 0) {
    lines.push({ label: 'Luminosità/esposizione', contributo: round2(v3 - v2) });
  }
  if (round2(v4 - v3) !== 0) {
    lines.push({
      label: `Correzione stato (riga ${a.rowSel.usedStato} per richiesta ${a.rowSel.requestedStato})`,
      contributo: round2(v4 - v3),
    });
  }
  if (a.boxValue > 0) {
    lines.push({ label: 'Box auto (valore a corpo)', contributo: a.boxValue });
  }
  return lines;
}
