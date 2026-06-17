import { describe, it, expect } from 'vitest';
import { NullPeriziaWriter } from '@/lib/perizia/null';
import { buildPeriziaInput } from '@/lib/perizia/prompt';
import type { EnrichResult } from '@/lib/valuation/types';

const enrich: EnrichResult = {
  superficie_commerciale_mq: 90,
  zona_omi_id: 'A',
  fallback_level: 'none',
  omi_eur_mq_min: 3500,
  omi_eur_mq_max: 4200,
  coefficients_applied: {},
  estimate_min: 300000,
  estimate_max: 360000,
  confidence: { score: 80, label: 'Alta', fsd: 0.05 },
  breakdown: [],
  comparables: [],
};

describe('NullPeriziaWriter', () => {
  it('ritorna null (degrado)', async () => {
    const input = buildPeriziaInput(
      enrich,
      { referenceId: 'VAL-X', indirizzo: null, comune: null, propertyType: null, superficieDichiarataMq: null },
      { catasto: null, documentFacts: null, narrative: null, transcripts: [] },
    );
    expect(await new NullPeriziaWriter().write(input)).toBeNull();
  });
});
