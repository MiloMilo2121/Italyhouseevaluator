import { describe, it, expect } from 'vitest';
import { boxAutoValue } from '@/lib/valuation/surface';
import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import { ZONE_A, POINT_IN_A } from './fixtures/omi-zones.fixture';
import { makeSubject } from './fixtures/subjects.fixture';

const w = defaultCoefficientSet.surfaceWeights;

describe('box auto come valore a corpo scalato sul €/mq di zona (fix #8)', () => {
  it('box = box_auto_mq_default × omiMid × box_auto_coeff (15 × 3850 × 0.45 = 25987.5)', () => {
    expect(boxAutoValue(w, 3850, true)).toBe(25987.5);
  });

  it('nessun garage ⇒ 0; nessun OMI ⇒ 0 (no doppio impatto silenzioso)', () => {
    expect(boxAutoValue(w, 3850, false)).toBe(0);
    expect(boxAutoValue(w, null, true)).toBe(0);
  });

  it('enrich con garage produce una voce "Box auto" nel breakdown', async () => {
    const deps: EnrichDeps = {
      coefficientSet: defaultCoefficientSet,
      omiResolver: new FakeOmiResolver([ZONE_A]),
      comparablesProvider: emptyComparablesProvider,
    };
    const r = await enrich(makeSubject({ hasGarage: true, location: POINT_IN_A }), deps);
    const boxLine = r.breakdown.find((l) => l.label.includes('Box auto'));
    expect(boxLine?.contributo).toBe(25987.5);
  });
});
