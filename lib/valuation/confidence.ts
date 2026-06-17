import type {
  ConfidenceLabel,
  ConfidenceResult,
  FallbackLevel,
  OmiQuotationRow,
  SubjectProperty,
} from './types';
import { clamp } from './util';

/**
 * Confidence score 0–100 (§6.7), funzione trasparente e sostituibile. Parte da
 * una base e penalizza: fallback spaziale usato, dati OMI mancanti, spread OMI
 * ampio, attributi chiave mancanti. Mappata in label Alta/Media/Bassa + FSD
 * placeholder. Predisposta per essere sostituita da un FSD reale out-of-sample.
 */

export interface ConfidenceInputs {
  fallbackLevel: FallbackLevel;
  omiRow: OmiQuotationRow | null;
  subject: SubjectProperty;
  /** Sintesi comparabili (V2): se presenti, raffinano la confidenza (FSD-like). */
  comps?: { n: number; relDispersion: number; avgMonths: number };
}

const FALLBACK_PENALTY: Record<FallbackLevel, number> = {
  none: 0,
  nearest: 30,
  comune: 45,
  prior_only: 60,
};

const FSD_BY_LABEL: Record<ConfidenceLabel, number> = {
  Alta: 0.05,
  Media: 0.1,
  Bassa: 0.16,
};

export function scoreToLabel(score: number): ConfidenceLabel {
  if (score >= 75) return 'Alta';
  if (score >= 45) return 'Media';
  return 'Bassa';
}

export function fsdForLabel(label: ConfidenceLabel): number {
  return FSD_BY_LABEL[label];
}

export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const { fallbackLevel, omiRow, subject, comps } = inputs;
  let score = 100;

  score -= FALLBACK_PENALTY[fallbackLevel];

  if (omiRow == null) {
    // Nessun dato OMI usabile. Se non è già marcato prior_only, penalizza qui.
    if (fallbackLevel !== 'prior_only') score -= 40;
  } else {
    const spread = (omiRow.comprMax - omiRow.comprMin) / omiRow.comprMin;
    if (spread > 0.5) score -= 20;
    else if (spread > 0.3) score -= 10;
  }

  // Attributi chiave mancanti.
  if (subject.classeEnergetica == null) score -= 8;
  if (subject.piano == null && subject.pianoLabel == null) score -= 5;
  if (subject.stanze == null) score -= 3;

  // Raffinamento comparabili (V2): più comp ⇒ bonus; dispersione/staleness ⇒ penalità.
  if (comps && comps.n > 0) {
    score += Math.min(comps.n, 6) * 3; // fino a +18
    if (comps.relDispersion > 0.25) score -= 15;
    else if (comps.relDispersion > 0.15) score -= 8;
    if (comps.avgMonths > 18) score -= 10;
    else if (comps.avgMonths > 12) score -= 5;
  }

  score = clamp(score, 0, 100);
  const label = scoreToLabel(score);
  return { score, label, fsd: fsdForLabel(label) };
}
