import { classeEnergeticaFactor, statoCorrectiveFactor } from './coefficients';
import { resolvePianoFactor } from './coefficient';
import { condizioniToStato } from './omi';
import { discountedEurMq, type MacroArea } from '@/lib/comps/discount';
import type { HedonicModel } from './hedonic';
import { clamp, round2 } from './util';
import type { ComparablesProvider, ComparablesQueryOpts } from './ports';
import type {
  Comparable,
  ComparableContribution,
  Estimate,
  MeritCoefficients,
  SubjectProperty,
  WeightedComparable,
} from './types';

/**
 * Market Comparison Approach (MCA) pesato — V2 Step 1. Estende lo scaffold M2:
 * `weightComparables` (pesi distanza×similarità×tempo×zona) resta; `reconcile`
 * ora implementa la griglia di omogeneizzazione (correzione €/mq dei comp verso
 * il subject), la media pesata, il clamp di sanity sul prior OMI e lo shrinkage.
 * In Fase 1 (nessun comp) ritorna il prior OMI (α = 0).
 */

const BANDWIDTH_M = 400; // h del kernel gaussiano spaziale
const TIME_LAMBDA = 0.05; // decadimento mensile
const GAMMA_SURFACE = 0.0005; // peso similarità sulla superficie
const ZONE_OUT_FACTOR = 0.3; // peso ridotto fuori zona OMI
const CLAMP_BAND = 0.5; // mcaPoint vincolato entro prior.point ± 50% (sanity)
const MIN_REL_HALFWIDTH = 0.03; // range mai più stretto del 3% del valore

export async function selectComparables(
  subject: SubjectProperty,
  provider: ComparablesProvider,
  opts?: ComparablesQueryOpts,
): Promise<Comparable[]> {
  return provider.find(subject, opts);
}

function monthsBetween(saleDateIso: string, now: Date): number {
  const sale = new Date(saleDateIso).getTime();
  const diffMs = now.getTime() - sale;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.44));
}

/** Peso composito w = f_dist × f_sim × f_time × I_zonaOMI (§6.6). `now` iniettabile. */
export function weightComparables(
  subject: SubjectProperty,
  comps: Comparable[],
  now: Date = new Date(),
): WeightedComparable[] {
  return comps.map((c) => {
    const fDist = Math.exp(-(c.distanceMeters ** 2) / (2 * BANDWIDTH_M ** 2));
    const surfaceDiff = subject.superficieMq - c.superficieCommercialeMq;
    const fSim = Math.exp(-GAMMA_SURFACE * surfaceDiff ** 2);
    const fTime = Math.exp(-TIME_LAMBDA * monthsBetween(c.saleDate, now));
    const iZona = c.sameOmiZone ? 1 : ZONE_OUT_FACTOR;
    return { ...c, weight: fDist * fSim * fTime * iZona };
  });
}

export interface CompsSummary {
  n: number;
  relDispersion: number; // coeff. di variazione dei €/mq grezzi
  avgMonths: number; // età media degli annunci/rogiti
}

/** Sintesi dei comparabili per la confidenza (n, dispersione relativa, freschezza). */
export function compsSummary(comps: Comparable[], now: Date = new Date()): CompsSummary {
  const n = comps.length;
  if (n === 0) return { n: 0, relDispersion: 0, avgMonths: 0 };
  const prices = comps.map((c) => c.pricePerMq);
  const mean = prices.reduce((s, p) => s + p, 0) / n;
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / n;
  const relDispersion = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const avgMonths = comps.reduce((s, c) => s + monthsBetween(c.saleDate, now), 0) / n;
  return { n, relDispersion: round2(relDispersion), avgMonths: round2(avgMonths) };
}

/** α = n / (n + k). n = 0 ⇒ α = 0 (ci si fida del prior OMI). */
export function shrinkageAlpha(nComp: number, k: number): number {
  if (nComp + k === 0) return 0;
  return nComp / (nComp + k);
}

/** Shrinkage scalare: valore = α·MCA + (1−α)·prior. */
export function applyShrinkage(mcaEstimate: number | null, priorOmi: number, alpha: number): number {
  if (mcaEstimate == null) return priorOmi;
  return alpha * mcaEstimate + (1 - alpha) * priorOmi;
}

// ---- Griglia di omogeneizzazione (adjustment grid) ----

/** Fattore di merito del SUBJECT: piano × classe × correttivo-stato (qui lo stato è un fattore, non riga OMI). */
export function subjectMeritFactor(subject: SubjectProperty, merit: MeritCoefficients): number {
  const piano = resolvePianoFactor(
    subject.piano,
    subject.pianoLabel,
    subject.pianiEdificio,
    subject.ascensore,
    merit.piano,
  ).factor;
  const classe = classeEnergeticaFactor(merit, subject.classeEnergetica);
  const stato = statoCorrectiveFactor(merit, condizioniToStato(subject.condizioni, subject.anniRistrutturazione));
  return piano * classe * stato;
}

/** Fattore di merito di un COMP (attributi assenti ⇒ fattore 1.00). */
export function compMeritFactor(comp: Comparable, merit: MeritCoefficients): number {
  const piano = resolvePianoFactor(
    comp.piano ?? null,
    comp.pianoLabel ?? null,
    comp.pianiEdificio ?? null,
    comp.ascensore ?? false,
    merit.piano,
  ).factor;
  const classe = classeEnergeticaFactor(merit, comp.classeEnergetica ?? null);
  const stato = statoCorrectiveFactor(merit, comp.stato);
  return piano * classe * stato;
}

/**
 * €/mq del comp corretto verso il subject: prezzo scontato (offerta→rogito) ×
 * (merito_subject / merito_comp). È la riga della griglia di omogeneizzazione.
 */
export function adjustedEurMq(
  subject: SubjectProperty,
  comp: Comparable,
  merit: MeritCoefficients,
  macroArea?: MacroArea,
): number {
  const discounted = discountedEurMq(comp.pricePerMq, comp.source, macroArea);
  const ratio = subjectMeritFactor(subject, merit) / Math.max(compMeritFactor(comp, merit), 1e-9);
  return round2(discounted * ratio);
}

/**
 * €/mq del comp corretto verso il subject. Se è presente un modello EDONICO
 * (Fase 2), usa il suo fattore data-driven (sconto offerta→rogito × adjustFactor);
 * altrimenti il rapporto di merito FISSO. β=prior ⇒ i due coincidono.
 */
export function correctedEurMq(
  subject: SubjectProperty,
  comp: Comparable,
  ctx: { merit: MeritCoefficients; macroArea?: MacroArea; hedonicModel?: HedonicModel },
): number {
  if (ctx.hedonicModel) {
    return round2(discountedEurMq(comp.pricePerMq, comp.source, ctx.macroArea) * ctx.hedonicModel.adjustFactor(comp));
  }
  return adjustedEurMq(subject, comp, ctx.merit, ctx.macroArea);
}

/** Griglia di omogeneizzazione per il report (comparabili attribuiti). */
export function buildAdjustmentGrid(
  weighted: WeightedComparable[],
  ctx: { subject: SubjectProperty; merit: MeritCoefficients; macroArea?: MacroArea; hedonicModel?: HedonicModel },
): ComparableContribution[] {
  return weighted.map((c) => ({
    id: c.id,
    source: c.source ?? 'annuncio',
    distanceMeters: round2(c.distanceMeters),
    saleDate: c.saleDate,
    stato: c.stato,
    rawEurMq: round2(c.pricePerMq),
    discountedEurMq: discountedEurMq(c.pricePerMq, c.source, ctx.macroArea),
    correctedEurMq: correctedEurMq(ctx.subject, c, ctx),
    weight: round2(c.weight),
  }));
}

export interface ReconcileCtx {
  subject: SubjectProperty;
  merit: MeritCoefficients;
  surfaceCommercialeMq: number;
  shrinkageK: number;
  macroArea?: MacroArea;
  /** Modello edonico (Fase 2): se presente, l'omogeneizzazione è data-driven. */
  hedonicModel?: HedonicModel;
}

/**
 * Riconciliazione MCA ↔ prior OMI. Senza comp (o senza ctx) ritorna il prior.
 * Altrimenti: media pesata dei €/mq corretti → punto MCA, clamp di sanity entro
 * prior.point ± 50%, shrinkage col prior (α = n/(n+k)); half-width dalla
 * dispersione pesata, blendata col prior, con floor minimo.
 */
export function reconcile(
  weighted: WeightedComparable[],
  priorOmi: Estimate,
  ctx?: ReconcileCtx,
): Estimate {
  if (weighted.length === 0 || ctx == null) return priorOmi;

  const corrected = weighted.map((w) => ({
    weight: w.weight,
    eurMq: correctedEurMq(ctx.subject, w, ctx),
  }));
  const sumW = corrected.reduce((s, c) => s + c.weight, 0);
  if (sumW <= 0) return priorOmi;

  const mcaEurMq = corrected.reduce((s, c) => s + c.weight * c.eurMq, 0) / sumW;
  const rawMcaPoint = mcaEurMq * ctx.surfaceCommercialeMq;
  const mcaPoint = clamp(
    rawMcaPoint,
    priorOmi.pointEstimate * (1 - CLAMP_BAND),
    priorOmi.pointEstimate * (1 + CLAMP_BAND),
  );

  const alpha = shrinkageAlpha(weighted.length, ctx.shrinkageK);
  const point = round2(applyShrinkage(mcaPoint, priorOmi.pointEstimate, alpha));

  // Half-width dalla dispersione pesata dei €/mq corretti, blendata col prior.
  const variance = corrected.reduce((s, c) => s + c.weight * (c.eurMq - mcaEurMq) ** 2, 0) / sumW;
  const stdEurMq = Math.sqrt(Math.max(0, variance));
  const mcaHalfWidth = stdEurMq * ctx.surfaceCommercialeMq;
  const priorHalfWidth = (priorOmi.max - priorOmi.min) / 2;
  let halfWidth = applyShrinkage(mcaHalfWidth, priorHalfWidth, alpha);
  halfWidth = Math.max(halfWidth, point * MIN_REL_HALFWIDTH);
  halfWidth = round2(halfWidth);

  return {
    min: round2(point - halfWidth),
    max: round2(point + halfWidth),
    pointEstimate: point,
  };
}
