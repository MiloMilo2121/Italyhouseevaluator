import { describe, it, expect } from 'vitest';
import { adjustedEurMq, reconcile, weightComparables } from '@/lib/valuation/comparables';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { makeSubject } from './fixtures/subjects.fixture';
import { makeComp } from './fixtures/comps.fixture';
import type { Estimate } from '@/lib/valuation/types';

const m = defaultCoefficientSet.meritCoefficients;
const NOW = new Date('2026-01-01');

// Subject "neutro": piano 1 + ascensore (1.00), classe D (1.00), parz_ristrutturata
// → Normale (stato_corrective 1.00) ⇒ meritFactor = 1.00.
const neutralSubject = makeSubject({
  piano: 1,
  pianiEdificio: 5,
  ascensore: true,
  classeEnergetica: 'D',
  condizioni: 'parz_ristrutturata',
  anniRistrutturazione: null,
  superficieMq: 100,
});

const prior: Estimate = { min: 190000, max: 210000, pointEstimate: 200000 };

describe('MCA — griglia di omogeneizzazione + reconcile (V2)', () => {
  it('adjustedEurMq: prezzo scontato × (merito_subject / merito_comp)', () => {
    // subject classe A ⇒ merito 1.05; comp classe D ⇒ merito 1.00; annuncio nord_est 5%
    const subjA = makeSubject({
      piano: 1,
      pianiEdificio: 5,
      ascensore: true,
      classeEnergetica: 'A',
      condizioni: 'parz_ristrutturata',
      anniRistrutturazione: null,
    });
    const comp = makeComp({ pricePerMq: 2000, classeEnergetica: 'D', stato: 'Normale' });
    // discounted = 1900 ; ratio 1.05/1.00 ⇒ 1995
    expect(adjustedEurMq(subjA, comp, m, 'nord_est')).toBe(1995);
  });

  it('worked example: media pesata dei €/mq corretti + shrinkage col prior (€ esatti)', () => {
    const comps = [
      makeComp({ id: 'a', pricePerMq: 2000 }),
      makeComp({ id: 'b', pricePerMq: 2100 }),
      makeComp({ id: 'c', pricePerMq: 2200 }),
    ]; // merito = subject ⇒ corretto = scontato (1900/1995/2090), pesi uguali
    const weighted = weightComparables(neutralSubject, comps, NOW);
    const est = reconcile(weighted, prior, {
      subject: neutralSubject,
      merit: m,
      surfaceCommercialeMq: 100,
      shrinkageK: 3,
      macroArea: 'nord_est',
    });
    // mcaEurMq = 1995 ⇒ mcaPoint = 199500 ; α = 3/6 = 0.5 ; point = 199750
    expect(est.pointEstimate).toBe(199750);
    expect(est.min).toBeLessThan(est.pointEstimate);
    expect(est.max).toBeGreaterThan(est.pointEstimate);
    expect(est.max - est.pointEstimate).toBeCloseTo(est.pointEstimate - est.min, 2); // simmetrico
  });

  it('clamp di sanity: comp fuori scala ⇒ mcaPoint vincolato a prior.point ± 50%', () => {
    const comps = [makeComp({ id: 'x', pricePerMq: 100000 })]; // assurdo
    const weighted = weightComparables(neutralSubject, comps, NOW);
    const est = reconcile(weighted, prior, {
      subject: neutralSubject,
      merit: m,
      surfaceCommercialeMq: 100,
      shrinkageK: 3,
      macroArea: 'nord_est',
    });
    // mcaPoint clampato a 300000 ; α = 1/4 = 0.25 ; point = 0.25·300000 + 0.75·200000 = 225000
    expect(est.pointEstimate).toBe(225000);
  });

  it('senza comparabili (o senza ctx) ⇒ ritorna il prior OMI', () => {
    expect(reconcile([], prior)).toBe(prior);
    expect(reconcile(weightComparables(neutralSubject, [makeComp({})], NOW), prior)).toBe(prior);
  });

  it('più comparabili ⇒ α più alto ⇒ stima più vicina all’MCA', () => {
    const comps = [makeComp({ id: 'a', pricePerMq: 2000 }), makeComp({ id: 'b', pricePerMq: 2000 })];
    const weighted = weightComparables(neutralSubject, comps, NOW);
    const ctx = { subject: neutralSubject, merit: m, surfaceCommercialeMq: 100, macroArea: 'nord_est' as const };
    const lowK = reconcile(weighted, prior, { ...ctx, shrinkageK: 1 }); // α = 2/3
    const highK = reconcile(weighted, prior, { ...ctx, shrinkageK: 20 }); // α = 2/22
    // mcaPoint = 1900 × 100 = 190000 (sotto il prior 200000) ⇒ α alto avvicina a 190000
    expect(lowK.pointEstimate).toBeLessThan(highK.pointEstimate);
  });
});
