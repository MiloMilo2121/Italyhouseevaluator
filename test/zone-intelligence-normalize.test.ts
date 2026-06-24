import { describe, it, expect } from 'vitest';
import { normalizeZoneIntelligence, type RawZoneResearch } from '@/lib/perplexity/prompt';
import type { ZoneIntelligenceQuery } from '@/lib/valuation/ports';

const q = (omiMin: number | null, omiMax: number | null): ZoneIntelligenceQuery => ({
  comune: 'Milano',
  zonaOmiId: 'MI_1',
  indirizzo: null,
  location: { lat: 45.46, lng: 9.19 },
  omiEurMqMin: omiMin,
  omiEurMqMax: omiMax,
  propertyType: 'appartamento',
});
const raw = (over: Partial<RawZoneResearch> = {}): RawZoneResearch => ({
  desirability_score: 70,
  note_qualitative: 'zona centrale',
  web_eur_mq_min: null,
  web_eur_mq_max: null,
  venduto_recente: null,
  vendibile_recente: null,
  sources: [],
  ...over,
});
const opts = { deviationThreshold: 0.1, model: 'sonar-pro', retrievedAt: '2026-06-19T00:00:00Z' };

describe('zone intelligence — normalizzazione deterministica (Fase 3)', () => {
  it('scostamento web vs OMI calcolato da NOI: web più alto ⇒ web_higher', () => {
    const z = normalizeZoneIntelligence(raw({ web_eur_mq_min: 4000, web_eur_mq_max: 5000 }), q(3000, 3400), opts);
    expect(z.omi_deviation_flag).toBe('web_higher');
    expect(z.omi_deviation_pct).toBeGreaterThan(0.1);
  });

  it('entro soglia ⇒ aligned', () => {
    const z = normalizeZoneIntelligence(raw({ web_eur_mq_min: 3100, web_eur_mq_max: 3300 }), q(3000, 3400), opts);
    expect(z.omi_deviation_flag).toBe('aligned');
  });

  it('prezzi web assenti ⇒ unknown', () => {
    const z = normalizeZoneIntelligence(raw(), q(3000, 3400), opts);
    expect(z.omi_deviation_flag).toBe('unknown');
    expect(z.omi_deviation_pct).toBeNull();
  });

  it('desirability clampata e label coerente', () => {
    expect(normalizeZoneIntelligence(raw({ desirability_score: 150 }), q(null, null), opts).desirability_score).toBe(100);
    expect(normalizeZoneIntelligence(raw({ desirability_score: 80 }), q(null, null), opts).desirability_label).toBe('alta');
    expect(normalizeZoneIntelligence(raw({ desirability_score: 50 }), q(null, null), opts).desirability_label).toBe('media');
    expect(normalizeZoneIntelligence(raw({ desirability_score: 10 }), q(null, null), opts).desirability_label).toBe('bassa');
  });
});
