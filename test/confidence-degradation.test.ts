import { describe, it, expect } from 'vitest';
import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import {
  ZONE_A,
  ZONE_EMPTY,
  QUOTATIONS_A,
  POINT_IN_A,
  POINT_IN_ZONE_NO_OMI,
  POINT_OUTSIDE,
} from './fixtures/omi-zones.fixture';
import { makeSubject } from './fixtures/subjects.fixture';
import type { OmiResolution } from '@/lib/valuation/types';

const base = {
  coefficientSet: defaultCoefficientSet,
  comparablesProvider: emptyComparablesProvider,
};

const NEAREST: OmiResolution = {
  zonaOmiId: 'A',
  fallbackLevel: 'nearest',
  rows: QUOTATIONS_A,
  semestre: '2024-2',
};

describe('graceful degradation (§6.2, §13)', () => {
  it('in zona ⇒ fallback none, confidenza Alta', async () => {
    const deps: EnrichDeps = { ...base, omiResolver: new FakeOmiResolver([ZONE_A]) };
    const r = await enrich(makeSubject({ location: POINT_IN_A }), deps);
    expect(r.fallback_level).toBe('none');
    expect(r.confidence.label).toBe('Alta');
  });

  it('punto fuori zona con nearest ⇒ fallback_level nearest, confidenza ridotta e range più ampio', async () => {
    const inZoneDeps: EnrichDeps = { ...base, omiResolver: new FakeOmiResolver([ZONE_A]) };
    const nearDeps: EnrichDeps = { ...base, omiResolver: new FakeOmiResolver([ZONE_A], NEAREST) };

    const inZone = await enrich(makeSubject({ location: POINT_IN_A }), inZoneDeps);
    const near = await enrich(makeSubject({ location: POINT_OUTSIDE }), nearDeps);

    expect(near.fallback_level).toBe('nearest');
    expect(near.confidence.label).toBe('Media');
    expect(near.confidence.score).toBeLessThan(inZone.confidence.score);
    // Stessa base OMI, ma range più ampio per via della confidenza più bassa.
    expect(near.estimate_max! - near.estimate_min!).toBeGreaterThan(
      inZone.estimate_max! - inZone.estimate_min!,
    );
  });

  it('punto fuori da ogni zona, nessun dato ⇒ prior_only, estimate null, confidenza Bassa', async () => {
    const deps: EnrichDeps = { ...base, omiResolver: new FakeOmiResolver([ZONE_A]) };
    const r = await enrich(makeSubject({ location: POINT_OUTSIDE }), deps);
    expect(r.fallback_level).toBe('prior_only');
    expect(r.estimate_min).toBeNull();
    expect(r.estimate_max).toBeNull();
    expect(r.confidence.label).toBe('Bassa');
  });

  it('zona risolta ma senza dati OMI ⇒ prior_only, confidenza Bassa', async () => {
    const deps: EnrichDeps = { ...base, omiResolver: new FakeOmiResolver([ZONE_EMPTY]) };
    const r = await enrich(makeSubject({ location: POINT_IN_ZONE_NO_OMI }), deps);
    expect(r.estimate_min).toBeNull();
    expect(r.confidence.label).toBe('Bassa');
  });
});
