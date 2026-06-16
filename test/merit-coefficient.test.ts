import { describe, it, expect } from 'vitest';
import { computeMeritCoefficient } from '@/lib/valuation/coefficient';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { makeSubject } from './fixtures/subjects.fixture';

const m = defaultCoefficientSet.meritCoefficients;

describe('coefficiente di merito (§6.4)', () => {
  it('prodotto piano × classe energetica (3° con ascensore, classe A) = 1.05', () => {
    const r = computeMeritCoefficient(
      makeSubject({ piano: 3, pianiEdificio: 6, ascensore: true, classeEnergetica: 'A' }),
      m,
      1,
    );
    expect(r.factors['piano']).toBe(1.0);
    expect(r.factors['classe_energetica']).toBe(1.05);
    expect(r.coefficient).toBe(1.05);
  });

  it('attributi assenti ⇒ fattore 1.00', () => {
    const r = computeMeritCoefficient(
      makeSubject({ piano: null, pianoLabel: null, pianiEdificio: null, classeEnergetica: null }),
      m,
      1,
    );
    expect(r.coefficient).toBe(1.0);
  });

  it('alto senza ascensore (0.80) × classe G (0.955) = 0.764', () => {
    const r = computeMeritCoefficient(
      makeSubject({ piano: 5, pianiEdificio: 8, ascensore: false, classeEnergetica: 'G' }),
      m,
      1,
    );
    expect(r.factors['piano']).toBe(0.8);
    expect(r.coefficient).toBe(0.764);
  });

  it('lo stateCorrective entra nel prodotto solo quando passato ≠ 1', () => {
    const r = computeMeritCoefficient(
      makeSubject({ piano: 3, pianiEdificio: 6, ascensore: true, classeEnergetica: 'A' }),
      m,
      1.1,
    );
    expect(r.factors['stato_corrective']).toBe(1.1);
    expect(r.coefficient).toBe(1.155);
  });
});
