import { describe, it, expect } from 'vitest';
import { applyBoundedCorrection } from '@/lib/valuation/correction/clamp';
import type { CorrectionParams, Estimate, ZoneIntelligence } from '@/lib/valuation/types';
import type { RawCorrection } from '@/lib/valuation/ports';

const estimate: Estimate = { min: 90000, max: 110000, pointEstimate: 100000 };
const params: CorrectionParams = { enabled: true, clampMaxPct: 0.06, requireZoneIntel: true };
const zi: ZoneIntelligence = {
  desirability_score: 80,
  desirability_label: 'alta',
  note_qualitative: 'zona ambita',
  web_eur_mq_min: null,
  web_eur_mq_max: null,
  omi_deviation_pct: null,
  omi_deviation_flag: 'unknown',
  venduto_recente: null,
  vendibile_recente: null,
  sources: [],
  model: 'sonar-pro',
  retrieved_at: '2026-06-19T00:00:00.000Z',
};
const raw = (factor: number): RawCorrection => ({ factor_raw: factor, motivazione: 'test' });
const AT = '2026-06-19T00:00:00.000Z';

describe('correzione vincolata (Fase 4) — il clamp', () => {
  it('fattore dentro la banda ⇒ applicato tal quale, point = det × fattore', () => {
    const r = applyBoundedCorrection(estimate, raw(1.03), params, zi, 'm', AT);
    expect(r.applied.clamped).toBe(false);
    expect(r.applied.factor_applied).toBe(1.03);
    expect(r.estimate.pointEstimate).toBe(103000);
    expect(r.estimate.min).toBe(92700);
    expect(r.estimate.max).toBe(113300);
  });

  it('fattore sopra la banda ⇒ clampato a 1+max', () => {
    const r = applyBoundedCorrection(estimate, raw(1.3), params, zi, 'm', AT);
    expect(r.applied.clamped).toBe(true);
    expect(r.applied.factor_applied).toBe(1.06);
    expect(r.estimate.pointEstimate).toBe(106000);
  });

  it('fattore sotto la banda ⇒ clampato a 1−max', () => {
    const r = applyBoundedCorrection(estimate, raw(0.5), params, zi, 'm', AT);
    expect(r.applied.clamped).toBe(true);
    expect(r.applied.factor_applied).toBe(0.94);
    expect(r.estimate.pointEstimate).toBe(94000);
  });

  it('requireZoneIntel + zoneIntel assente ⇒ fattore 1, basis none', () => {
    const r = applyBoundedCorrection(estimate, raw(1.05), params, null, 'm', AT);
    expect(r.applied.factor_applied).toBe(1);
    expect(r.applied.basis).toBe('none');
    expect(r.estimate.pointEstimate).toBe(100000);
  });

  it('min/max scalano dello STESSO fattore (half-width relativa invariata)', () => {
    const r = applyBoundedCorrection(estimate, raw(1.05), params, zi, 'm', AT);
    const relBefore = (estimate.max - estimate.min) / estimate.pointEstimate;
    const relAfter = (r.estimate.max - r.estimate.min) / r.estimate.pointEstimate;
    expect(relAfter).toBeCloseTo(relBefore, 6);
  });
});
