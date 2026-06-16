import { describe, it, expect } from 'vitest';
import { computeRange } from '@/lib/valuation/range';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import type { ConfidenceResult } from '@/lib/valuation/types';

const params = defaultCoefficientSet.meritCoefficients.range;
const ALTA: ConfidenceResult = { score: 100, label: 'Alta', fsd: 0.05 };
const MEDIA: ConfidenceResult = { score: 60, label: 'Media', fsd: 0.1 };
const BASSA: ConfidenceResult = { score: 20, label: 'Bassa', fsd: 0.16 };

describe('range accoppiato alla confidenza (fix #4)', () => {
  it('Alta ⇒ il range coincide col range OMI grezzo [base_min, base_max]', () => {
    const r = computeRange(312375, 374850, 0, ALTA, params)!;
    expect(r.pointEstimate).toBe(343612.5);
    expect(r.min).toBe(312375);
    expect(r.max).toBe(374850);
  });

  it('Media ⇒ half-width OMI × 1.25 (più ampio)', () => {
    const r = computeRange(312375, 374850, 0, MEDIA, params)!;
    expect(r.pointEstimate).toBe(343612.5);
    // omiHW=31237.5 ×1.25 = 39046.88 (round2)
    expect(r.max).toBe(382659.38);
    expect(r.min).toBe(304565.62);
  });

  it('Bassa con spread OMI stretto ⇒ il floor relativo (14%) vincola il range', () => {
    // base stretto: omiHW=2500, ×1.6=4000; floor=302500×0.14=42350 ⇒ vince il floor
    const r = computeRange(300000, 305000, 0, BASSA, params)!;
    expect(r.pointEstimate).toBe(302500);
    expect(r.min).toBe(260150);
    expect(r.max).toBe(344850);
  });

  it('il box auto trasla la stima verso l’alto senza allargare l’half-width', () => {
    const noBox = computeRange(312375, 374850, 0, ALTA, params)!;
    const withBox = computeRange(312375, 374850, 20000, ALTA, params)!;
    expect(withBox.pointEstimate - noBox.pointEstimate).toBe(20000);
    expect(withBox.max - withBox.min).toBe(noBox.max - noBox.min);
  });

  it('senza OMI ⇒ range null', () => {
    expect(computeRange(null, null, 0, ALTA, params)).toBeNull();
  });
});
