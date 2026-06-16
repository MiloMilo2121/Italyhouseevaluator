import type { ConfidenceResult, Estimate, RangeParams } from './types';
import { round2 } from './util';

/**
 * Costruzione del range accoppiata alla confidenza (fix #4). Il range e la
 * confidenza devono raccontare la stessa storia: una confidenza più bassa
 * ALLARGA il range (moltiplicatore sull'half-width OMI + un floor relativo
 * minimo). Con confidenza Alta (moltiplicatore 1.0, floor non vincolante) il
 * range coincide col range OMI grezzo [base_min, base_max].
 *
 * Il valore a corpo del box auto (boxValue) trasla l'intera stima verso l'alto
 * (sommato al point), senza allargare l'half-width.
 */
export function computeRange(
  baseMin: number | null,
  baseMax: number | null,
  boxValue: number,
  confidence: ConfidenceResult,
  params: RangeParams,
): Estimate | null {
  if (baseMin == null || baseMax == null) return null;

  const omiHalfWidth = (baseMax - baseMin) / 2;
  const point = round2((baseMin + baseMax) / 2 + boxValue);

  const multiplier = params.confidence_multiplier[confidence.label];
  const minRelHalfWidth = params.min_rel_halfwidth[confidence.label];

  const halfWidth = round2(Math.max(omiHalfWidth * multiplier, point * minRelHalfWidth));

  return {
    min: round2(point - halfWidth),
    max: round2(point + halfWidth),
    pointEstimate: point,
  };
}
