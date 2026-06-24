import { describe, it, expect } from 'vitest';
import { bboxAround, buildScrapeInput } from '@/lib/comps/apify-input';
import { extractImmobiliare, extractIdealista } from '@/lib/comps/apify';
import { normalizeListing } from '@/lib/comps/normalize';

describe('apify input + estrazione attributi (Fase 1)', () => {
  it('bboxAround: box simmetrico attorno al punto', () => {
    const b = bboxAround(45.46, 9.19, 3000);
    expect(b.north).toBeGreaterThan(45.46);
    expect(b.south).toBeLessThan(45.46);
    expect(b.east).toBeGreaterThan(9.19);
    expect(b.west).toBeLessThan(9.19);
    expect(b.north - 45.46).toBeCloseTo(3000 / 111320, 4); // ~3km in latitudine
  });

  it('buildScrapeInput include bbox e maxItems', () => {
    const inp = buildScrapeInput('immobiliare', { lat: 45.46, lng: 9.19 });
    expect(inp.maxItems).toBeGreaterThan(0);
    expect(inp.bbox.north).toBeGreaterThan(45.46);
  });

  it('extractImmobiliare estrae locali/terrazzo/balcone', () => {
    const raw = extractImmobiliare({
      id: 'x1',
      price: { raw: 200000 },
      topology: { surface: 90, rooms: 3, terrace: true, balcony: false },
      geography: { latitude: 45, longitude: 9 },
    });
    expect(raw?.locali).toBe(3);
    expect(raw?.hasTerrazzo).toBe(true);
    expect(raw?.hasBalcone).toBe(false);
  });

  it('extractIdealista estrae roomNumber/terrace', () => {
    const raw = extractIdealista({
      adid: 'y1',
      price: 180000,
      moreCharacteristics: { constructedArea: 80, roomNumber: 2, terrace: true },
      ubication: { latitude: 45, longitude: 9 },
    });
    expect(raw?.locali).toBe(2);
    expect(raw?.hasTerrazzo).toBe(true);
  });

  it('normalizeListing: locali in colonna, terrazzo/balcone in attributes', () => {
    const n = normalizeListing({
      listingId: 'z',
      portal: 'immobiliare',
      price: 200000,
      superficieMq: 100,
      lat: 45,
      lng: 9,
      locali: 3,
      hasTerrazzo: true,
      hasBalcone: false,
    });
    expect(n?.locali).toBe(3);
    expect(n?.attributes['terrazzo']).toBe(true);
    expect(n?.attributes['balcone']).toBe(false);
  });
});
