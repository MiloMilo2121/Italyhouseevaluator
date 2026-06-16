import { describe, it, expect } from 'vitest';
import { computeSurface, weightedSurface } from '@/lib/valuation/surface';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { makeSubject } from './fixtures/subjects.fixture';

const w = defaultCoefficientSet.surfaceWeights;

describe('superficie commerciale (§6.1, DPR 138)', () => {
  it('85 utile + 10 balcone scoperto (0.25) + 12 cantina non comunicante (0.25) = 90.5 esatti', () => {
    expect(
      weightedSurface([
        { areaMq: 85, coeff: 1.0 },
        { areaMq: 10, coeff: 0.25 },
        { areaMq: 12, coeff: 0.25 },
      ]),
    ).toBe(90.5);
  });

  it('computeSurface con metrature esplicite riproduce 90.5', () => {
    const subj = makeSubject({
      superficieMq: 85,
      hasBalcone: true,
      balconeAreaMq: 10,
      balconeCoperto: false,
      cantinaAreaMq: 12,
    });
    expect(computeSurface(subj, w).superficieCommercialeMq).toBe(90.5);
  });

  it('dotazioni booleane usano le aree di default calibrabili', () => {
    // 100*1 + 6*0.25 (balcone default) + 25*0.15 (giardino default) = 105.25
    const subj = makeSubject({ superficieMq: 100, hasBalcone: true, hasGiardino: true });
    expect(computeSurface(subj, w).superficieCommercialeMq).toBe(105.25);
  });

  it('attributi assenti contribuiscono 0; il box NON è una % della superficie', () => {
    const subj = makeSubject({
      superficieMq: 70,
      hasBalcone: false,
      hasGiardino: false,
      hasGarage: true, // box → valore a corpo, non superficie
    });
    expect(computeSurface(subj, w).superficieCommercialeMq).toBe(70);
  });

  it('tutte le pertinenze esplicite (balcone coperto, terrazzo, giardino, cantina, soffitta)', () => {
    // 80 + 8×0.35 + 5×0.25 + 30×0.15 + 10×0.25 + 4×0.25 = 92.05
    const subj = makeSubject({
      superficieMq: 80,
      hasBalcone: true,
      balconeAreaMq: 8,
      balconeCoperto: true,
      terrazzoAreaMq: 5,
      giardinoAreaMq: 30,
      cantinaAreaMq: 10,
      soffittaAreaMq: 4,
    });
    expect(computeSurface(subj, w).superficieCommercialeMq).toBe(92.05);
  });
});
