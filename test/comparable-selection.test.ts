import { describe, it, expect } from 'vitest';
import { similarity, splitByRadius, selectMostSimilar, subjectHasTerrazzo } from '@/lib/valuation/comparable-selection';
import { makeSubject } from './fixtures/subjects.fixture';
import { makeComp } from './fixtures/comps.fixture';

describe('selezione comparabili (Fase 2)', () => {
  const subject = makeSubject({ superficieMq: 100, stanze: 3, hasBalcone: true });

  it('similarità alta per stesso n. locali/superficie, bassa per molto diversi', () => {
    const simile = makeComp({ superficieCommercialeMq: 100, locali: 3 });
    const diverso = makeComp({ superficieCommercialeMq: 220, locali: 6 });
    expect(similarity(subject, simile)).toBeGreaterThan(similarity(subject, diverso));
    expect(similarity(subject, simile)).toBeGreaterThan(0.7);
  });

  it('terrazzo concorde aumenta la similarità rispetto a discorde', () => {
    const subjTerr = makeSubject({ terrazzoAreaMq: 12 });
    expect(subjectHasTerrazzo(subjTerr)).toBe(true);
    const conTerr = makeComp({ hasTerrazzo: true });
    const senzaTerr = makeComp({ hasTerrazzo: false });
    expect(similarity(subjTerr, conTerr)).toBeGreaterThan(similarity(subjTerr, senzaTerr));
  });

  it('attributi assenti ⇒ contributo neutro (nessun crash, score in [0,1])', () => {
    const noAttr = makeComp({ locali: null, hasTerrazzo: null, hasBalcone: null });
    const s = similarity(subject, noAttr);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('splitByRadius ordina per distanza e prende i nearestN più vicini', () => {
    const comps = [
      makeComp({ id: 'a', distanceMeters: 800 }),
      makeComp({ id: 'b', distanceMeters: 120 }),
      makeComp({ id: 'c', distanceMeters: 450 }),
    ];
    const { nearest, wide } = splitByRadius(comps, 2);
    expect(wide.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(nearest.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('selectMostSimilar restituisce i k più simili', () => {
    const comps = [
      makeComp({ id: 'big', superficieCommercialeMq: 250, locali: 7 }),
      makeComp({ id: 'match', superficieCommercialeMq: 100, locali: 3 }),
      makeComp({ id: 'mid', superficieCommercialeMq: 140, locali: 4 }),
    ];
    const top = selectMostSimilar(subject, comps, 1);
    expect(top[0]!.id).toBe('match');
  });
});
