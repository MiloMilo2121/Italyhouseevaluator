import { describe, it, expect } from 'vitest';
import { fitHedonic } from '@/lib/valuation/hedonic';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { makeSubject } from './fixtures/subjects.fixture';
import { makeComp } from './fixtures/comps.fixture';
import type { WeightedComparable } from '@/lib/valuation/types';

const merit = defaultCoefficientSet.meritCoefficients;
const subject = makeSubject({ superficieMq: 90, stanze: 3 });

function wcomp(over: Partial<WeightedComparable> = {}): WeightedComparable {
  return { ...makeComp(over), weight: over.weight ?? 1 };
}

/** Campione con un VERO premio terrazzo +8% (nessun altro effetto), uniforme. */
function terrazzoSample(n: number): WeightedComparable[] {
  const out: WeightedComparable[] = [];
  for (let i = 0; i < n; i++) {
    const terr = i % 2 === 0;
    out.push(
      wcomp({
        id: `c${i}`,
        superficieCommercialeMq: 70 + (i % 10) * 8,
        pricePerMq: 2000 * (terr ? 1.08 : 1.0),
        locali: 3,
        hasTerrazzo: terr,
        classeEnergetica: 'D',
        stato: 'Normale',
        piano: 1,
      }),
    );
  }
  return out;
}

const uniform = () => 1;

describe('stima edonica (Fase 2)', () => {
  it('n=0 ⇒ fallback ai fissi, adjustFactor finito e positivo', () => {
    const m = fitHedonic(subject, [], merit);
    expect(m.summary.usedFixedFallback).toBe(true);
    const f = m.adjustFactor(makeComp());
    expect(Number.isFinite(f)).toBe(true);
    expect(f).toBeGreaterThan(0);
  });

  it('n piccolo (2) ⇒ β≈prior (premi nuovi ~0), nessun NaN', () => {
    const m = fitHedonic(subject, terrazzoSample(2), merit, uniform);
    expect(m.summary.usedFixedFallback).toBe(true);
    expect(Math.abs(m.summary.betas['terrazzo']!)).toBeLessThan(0.04);
    expect(Math.abs(m.summary.betas['super']!)).toBeLessThan(0.06);
    expect(Number.isFinite(m.adjustFactor(makeComp()))).toBe(true);
  });

  it('segnale forte (30 comp, terrazzo +8%) ⇒ β_terrazzo recuperato, R² alto', () => {
    const m = fitHedonic(subject, terrazzoSample(30), merit, uniform);
    expect(m.summary.usedFixedFallback).toBe(false);
    expect(m.summary.betas['terrazzo']!).toBeGreaterThan(0.02);
    expect(m.summary.betas['terrazzo']!).toBeLessThan(0.12);
    expect(m.summary.r2Weighted).toBeGreaterThan(0.4);
    // Comp IDENTICO al subject salvo il terrazzo (subject senza, comp con) ⇒
    // correzione <1 verso il subject (il comp con terrazzo vale di più).
    const compTerr = makeComp({
      hasTerrazzo: true,
      classeEnergetica: 'A',
      stato: 'Ottimo',
      piano: 3,
      pianiEdificio: 6,
      ascensore: true,
      superficieCommercialeMq: 90,
      locali: 3,
    });
    expect(m.adjustFactor(compTerr)).toBeLessThan(1);
  });

  it('colonna costante (tutti senza terrazzo) ⇒ β_terrazzo resta ~0, stabile', () => {
    const comps = terrazzoSample(30).map((c) => ({ ...c, hasTerrazzo: false, pricePerMq: 2000 }));
    const m = fitHedonic(subject, comps, merit, uniform);
    expect(Math.abs(m.summary.betas['terrazzo']!)).toBeLessThan(0.01);
    expect(Number.isFinite(m.summary.betas['super']!)).toBe(true);
  });

  it('monotonia λ: più comparabili ⇒ λ minore (dati guidano di più)', () => {
    const few = fitHedonic(subject, terrazzoSample(5), merit, uniform);
    const many = fitHedonic(subject, terrazzoSample(40), merit, uniform);
    expect(many.summary.lambda).toBeLessThan(few.summary.lambda);
  });
});
