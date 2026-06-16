import { describe, it, expect } from 'vitest';
import {
  applyShrinkage,
  reconcile,
  selectComparables,
  shrinkageAlpha,
  weightComparables,
} from '@/lib/valuation/comparables';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import { makeSubject } from './fixtures/subjects.fixture';
import type { Comparable, Estimate } from '@/lib/valuation/types';

describe('scaffold comparabili (§6.5/6.6 — Fase 2)', () => {
  it('shrinkage: α = n/(n+k); n=0 ⇒ 0', () => {
    expect(shrinkageAlpha(0, 5)).toBe(0);
    expect(shrinkageAlpha(5, 5)).toBe(0.5);
  });

  it('applyShrinkage: MCA assente ⇒ prior; altrimenti blend lineare', () => {
    expect(applyShrinkage(null, 100, 0.5)).toBe(100);
    expect(applyShrinkage(200, 100, 0.5)).toBe(150);
  });

  it('reconcile in Fase 1 (nessun comparabile) ritorna il prior OMI', () => {
    const prior: Estimate = { min: 100, max: 200, pointEstimate: 150 };
    expect(reconcile([], prior)).toBe(prior);
  });

  it('weightComparables preserva la lunghezza e assegna un peso in (0,1]', () => {
    const comps: Comparable[] = [
      {
        id: 'c1',
        distanceMeters: 200,
        superficieCommercialeMq: 80,
        pricePerMq: 3000,
        saleDate: '2024-06-01',
        stato: 'Normale',
        sameOmiZone: true,
      },
    ];
    const w = weightComparables(makeSubject(), comps, new Date('2024-12-01'));
    expect(w).toHaveLength(1);
    expect(w[0]!.weight).toBeGreaterThan(0);
    expect(w[0]!.weight).toBeLessThanOrEqual(1);
  });

  it('selectComparables con provider vuoto ⇒ [] (Fase 1)', async () => {
    expect(await selectComparables(makeSubject(), emptyComparablesProvider)).toEqual([]);
  });
});
