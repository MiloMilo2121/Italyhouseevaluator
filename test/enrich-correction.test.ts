import { describe, it, expect } from 'vitest';
import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import { ZONE_A } from './fixtures/omi-zones.fixture';
import { makeSubject } from './fixtures/subjects.fixture';
import type { BoundedCorrector, ZoneIntelligenceProvider } from '@/lib/valuation/ports';
import type { ZoneIntelligence } from '@/lib/valuation/types';

const ZI: ZoneIntelligence = {
  desirability_score: 82,
  desirability_label: 'alta',
  note_qualitative: 'zona molto richiesta',
  web_eur_mq_min: 3600,
  web_eur_mq_max: 4300,
  omi_deviation_pct: 0.03,
  omi_deviation_flag: 'aligned',
  venduto_recente: 'tempi di vendita brevi',
  vendibile_recente: 'offerta scarsa',
  sources: [{ title: 'fonte', url: 'https://x' }],
  model: 'sonar-pro',
  retrieved_at: '2026-06-19T00:00:00Z',
};
const fakeZone: ZoneIntelligenceProvider = { research: async () => ZI };
const fakeCorrector: BoundedCorrector = {
  model: 'fake-sonnet',
  correct: async () => ({ factor_raw: 1.05, motivazione: 'zona ambita, domanda alta' }),
};

const subj = makeSubject({
  superficieMq: 85,
  stanze: 3,
  piano: 3,
  pianiEdificio: 6,
  ascensore: true,
  classeEnergetica: 'A',
  condizioni: 'ristrutturata',
  anniRistrutturazione: '<5',
});

describe('enrich + correzione vincolata (Fase 3+4)', () => {
  it('valore corretto = deterministico × fattore; deterministico conservato; breakdown tracciato', async () => {
    const deps: EnrichDeps = {
      coefficientSet: defaultCoefficientSet,
      omiResolver: new FakeOmiResolver([ZONE_A]),
      comparablesProvider: emptyComparablesProvider,
      zoneIntelligenceProvider: fakeZone,
      boundedCorrector: fakeCorrector,
      correctionParams: { enabled: true, clampMaxPct: 0.06, requireZoneIntel: false },
    };
    const r = await enrich(subj, deps);

    expect(r.zone_intelligence?.desirability_label).toBe('alta');
    expect(r.correction?.factor_applied).toBe(1.05);
    expect(r.correction?.clamped).toBe(false);
    // Deterministico dall'enrich-e2e: 312375 / 374850.
    expect(r.estimate_deterministic_min).toBe(312375);
    expect(r.estimate_deterministic_max).toBe(374850);
    // Corretto = × 1.05.
    expect(r.estimate_min).toBe(327993.75);
    expect(r.estimate_max).toBe(393592.5);
    expect(r.breakdown.some((b) => b.label.includes('Correzione contesto zona'))).toBe(true);
  });

  it('degrado: senza i provider, comportamento identico a oggi (nessuna correzione)', async () => {
    const deps: EnrichDeps = {
      coefficientSet: defaultCoefficientSet,
      omiResolver: new FakeOmiResolver([ZONE_A]),
      comparablesProvider: emptyComparablesProvider,
    };
    const r = await enrich(subj, deps);
    expect(r.correction).toBeNull();
    expect(r.zone_intelligence).toBeNull();
    expect(r.estimate_min).toBe(312375);
    expect(r.estimate_deterministic_min).toBe(312375);
  });

  it('correzione disabilitata (enabled=false) ⇒ nessuna correzione anche col corrector', async () => {
    const deps: EnrichDeps = {
      coefficientSet: defaultCoefficientSet,
      omiResolver: new FakeOmiResolver([ZONE_A]),
      comparablesProvider: emptyComparablesProvider,
      boundedCorrector: fakeCorrector,
      correctionParams: { enabled: false, clampMaxPct: 0.06, requireZoneIntel: false },
    };
    const r = await enrich(subj, deps);
    expect(r.correction).toBeNull();
    expect(r.estimate_min).toBe(312375);
  });
});
