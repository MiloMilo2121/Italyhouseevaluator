import { computeMeritCoefficient } from './coefficient';
import { reconcile, selectComparables, weightComparables } from './comparables';
import { computeConfidence } from './confidence';
import { computeBaseEstimate, condizioniToStato, selectOmiRow } from './omi';
import { computeRange } from './range';
import { boxAutoValue, computeSurface } from './surface';
import { round2 } from './util';
import type { OmiResolver, ComparablesProvider } from './ports';
import type { BreakdownLine, CoefficientSet, EnrichResult, SubjectProperty } from './types';

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

  // 6. Confidenza.
  const confidence = computeConfidence({
    fallbackLevel: resolution.fallbackLevel,
    omiRow: rowSel.row,
    subject,
  });

  // 7. Range (prior OMI) accoppiato alla confidenza.
  const priorEstimate = computeRange(base.baseMin, base.baseMax, boxValue, confidence, m.range);

  // 8. Comparabili (Fase 1 ⇒ [] ⇒ α=0 ⇒ valore = prior OMI).
  const comps = await selectComparables(subject, comparablesProvider);
  const weighted = weightComparables(subject, comps);
  const finalEstimate = priorEstimate ? reconcile(weighted, priorEstimate) : null;

  // 9. Breakdown voce-per-voce (contributi in € che sommano al point estimate).
  const breakdown = buildBreakdown({
    surface: surface.superficieCommercialeMq,
    omiMid,
    merit,
    rowSel,
    boxValue,
    classe: subject.classeEnergetica,
    semestre: resolution.semestre,
  });

  return {
    superficie_commerciale_mq: surface.superficieCommercialeMq,
    zona_omi_id: resolution.zonaOmiId,
    fallback_level: resolution.fallbackLevel,
    omi_eur_mq_min: rowSel.row?.comprMin ?? null,
    omi_eur_mq_max: rowSel.row?.comprMax ?? null,
    coefficients_applied: { ...merit.factors, merito_totale: merit.coefficient },
    estimate_min: finalEstimate?.min ?? null,
    estimate_max: finalEstimate?.max ?? null,
    confidence,
    breakdown,
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
