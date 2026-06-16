import { describe, it, expect } from 'vitest';
import {
  classeEnergeticaFactor,
  parseCoefficientSet,
  statoCorrectiveFactor,
} from '@/lib/valuation/coefficients';
import {
  DEFAULT_COEFFICIENT_SET_RAW,
  defaultCoefficientSet,
} from './fixtures/coefficient-set.fixture';

const m = defaultCoefficientSet.meritCoefficients;

describe('accessori coefficient_set (puri)', () => {
  it('classe energetica: null e sconosciuta → default 1.00; normalizza case/spazi', () => {
    expect(classeEnergeticaFactor(m, null)).toBe(1.0);
    expect(classeEnergeticaFactor(m, 'ZZZ')).toBe(1.0);
    expect(classeEnergeticaFactor(m, 'a4')).toBe(1.1);
    expect(classeEnergeticaFactor(m, ' A ')).toBe(1.05);
  });

  it('stato corrective', () => {
    expect(statoCorrectiveFactor(m, 'Ottimo')).toBe(1.1);
    expect(statoCorrectiveFactor(m, 'Scadente')).toBe(0.85);
  });

  it('parseCoefficientSet fallisce rumorosamente su payload malformati', () => {
    expect(() => parseCoefficientSet(null)).toThrow();
    expect(() =>
      parseCoefficientSet({ ...DEFAULT_COEFFICIENT_SET_RAW, superficie_weights: {} }),
    ).toThrow();
  });
});
