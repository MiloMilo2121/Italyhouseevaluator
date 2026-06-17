import { describe, it, expect } from 'vitest';
import { extractIdealistaData } from '@/lib/comps/sources/idealista';
import { normalizeListing } from '@/lib/comps/normalize';
import { discountedEurMq } from '@/lib/comps/discount';

const item = {
  propertyCode: 'IDX1',
  price: 250000,
  size: 100,
  latitude: 45.46,
  longitude: 9.19,
  propertyType: 'flat',
  status: 'good',
  floor: 3,
  hasLift: true,
  energyClass: 'C',
  date: '2025-06-01',
};

describe('extractIdealistaData', () => {
  it('mappa un annuncio idealista → RawListing (source annuncio implicito)', () => {
    const raw = extractIdealistaData(item)!;
    expect(raw.portal).toBe('idealista_data');
    expect(raw.listingId).toBe('IDX1');
    expect(raw.price).toBe(250000);
    expect(raw.superficieMq).toBe(100);
    expect(raw.lat).toBeCloseTo(45.46, 4);
    expect(raw.lng).toBeCloseTo(9.19, 4);
    expect(raw.source).toBeUndefined();
  });

  it('normalizza con source "annuncio" e applica lo sconto offerta→rogito', () => {
    const norm = normalizeListing(extractIdealistaData(item)!)!;
    expect(norm.source).toBe('annuncio');
    expect(norm.eur_mq).toBe(2500);
    expect(discountedEurMq(norm.eur_mq, norm.source, 'nord_est')).toBeLessThan(norm.eur_mq);
  });

  it('ritorna null senza id', () => {
    expect(extractIdealistaData({ price: 1 })).toBeNull();
    expect(extractIdealistaData(null)).toBeNull();
  });
});
