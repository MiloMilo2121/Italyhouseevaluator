/**
 * API pubblica del motore di valutazione. La API route (M4) importa da qui.
 */
export { enrich, type EnrichDeps } from './enrich';
export type { OmiResolver, ComparablesProvider } from './ports';

export { computeSurface, weightedSurface, boxAutoValue } from './surface';
export { condizioniToStato, selectOmiRow, computeBaseEstimate } from './omi';
export { computeMeritCoefficient, resolvePianoFactor } from './coefficient';
export { computeConfidence, scoreToLabel, fsdForLabel } from './confidence';
export { computeRange } from './range';
export { computeInputHash, referenceIdFromHash, type HashContext } from './hash';
export {
  parseCoefficientSet,
  classeEnergeticaFactor,
  statoCorrectiveFactor,
} from './coefficients';
export {
  selectComparables,
  weightComparables,
  reconcile,
  shrinkageAlpha,
  applyShrinkage,
} from './comparables';

export type * from './types';
