import { describe, it, expect } from 'vitest';
import {
  dedupComps,
  filterOutliers,
  normalizeListing,
  normalizeListings,
  type RawListing,
} from '@/lib/comps/normalize';

function raw(over: Partial<RawListing>): RawListing {
  return { listingId: '1', portal: 'immobiliare', price: 200000, superficieMq: 100, lat: 45.46, lng: 9.19, ...over };
}

describe('normalizzazione comparabili (V2)', () => {
  it('mapping + €/mq; scarta dati essenziali mancanti o €/mq fuori scala', () => {
    const c = normalizeListing(raw({ stato: 'Buono stato', classeEnergetica: 'C' }))!;
    expect(c.eur_mq).toBe(2000);
    expect(c.source).toBe('annuncio');
    expect(c.stato).toBe('Normale');
    expect(c.listing_id).toBe('immobiliare:1');

    expect(normalizeListing(raw({ price: null }))).toBeNull();
    expect(normalizeListing(raw({ superficieMq: 0 }))).toBeNull();
    expect(normalizeListing(raw({ lat: null }))).toBeNull();
    expect(normalizeListing(raw({ price: 50_000_000, superficieMq: 1 }))).toBeNull(); // €/mq fuori scala
  });

  it('dedup per listing_id e per cluster geo+superficie (stessa unità su più portali)', () => {
    const a = normalizeListing(raw({ listingId: '1' }))!;
    const aDup = normalizeListing(raw({ listingId: '1' }))!;
    const sameUnit = normalizeListing(raw({ listingId: '2', portal: 'idealista', lat: 45.46, lng: 9.19, superficieMq: 100 }))!;
    const other = normalizeListing(raw({ listingId: '3', lat: 45.5, lng: 9.3, superficieMq: 80 }))!;
    expect(dedupComps([a, aDup, sameUnit, other])).toHaveLength(2);
  });

  it('filterOutliers IQR scarta i €/mq anomali (≥4 comp)', () => {
    const comps = [2000, 2050, 2100, 2150, 10000].map(
      (eurMq, i) =>
        normalizeListing(raw({ listingId: String(i), lat: 45.46 + i * 0.01, price: eurMq * 100, superficieMq: 100 }))!,
    );
    const out = filterOutliers(comps);
    expect(out.some((c) => c.eur_mq === 10000)).toBe(false);
    expect(out).toHaveLength(4);
  });

  it('normalizeListings: pipeline completa (normalizza + dedup + outlier)', () => {
    expect(normalizeListings([raw({ listingId: '1' }), raw({ listingId: '1' })])).toHaveLength(1);
  });
});
