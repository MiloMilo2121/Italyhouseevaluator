import { describe, it, expect } from 'vitest';
import { extractImmobiliareInsights } from '@/lib/comps/sources/immobiliare-insights';
import { normalizeListing } from '@/lib/comps/normalize';
import { discountedEurMq } from '@/lib/comps/discount';

const item = {
  id: 'TX1',
  price: 300000,
  surface: 100,
  geo: { lat: 45.46, lng: 9.19 },
  condition: 'normale',
  floor: 2,
  elevator: false,
  transactionDate: '2025-03-01',
};

describe('extractImmobiliareInsights', () => {
  it('mappa una transazione → RawListing con source "agency"', () => {
    const raw = extractImmobiliareInsights(item)!;
    expect(raw.portal).toBe('immobiliare_insights');
    expect(raw.source).toBe('agency');
    expect(raw.price).toBe(300000);
    expect(raw.lat).toBeCloseTo(45.46, 4);
  });

  it('normalizza mantenendo "agency" e NON applica lo sconto (dato di chiusura)', () => {
    const norm = normalizeListing(extractImmobiliareInsights(item)!)!;
    expect(norm.source).toBe('agency');
    expect(norm.eur_mq).toBe(3000);
    expect(discountedEurMq(norm.eur_mq, norm.source, 'nord_est')).toBe(norm.eur_mq);
  });
});
