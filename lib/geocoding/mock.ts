import type { GeocodingProvider, GeocodingSuggestion, ResolvedPlace } from './types';

/**
 * Provider mock deterministico: fa girare funnel/dev/test/build SENZA chiavi
 * API. Ritorna qualche indirizzo di Milano e risolve a coordinate fisse.
 */

const SUGGESTIONS: GeocodingSuggestion[] = [
  { id: 'mock-1', label: 'Via Roma 1, Milano', secondary: 'Milano (MI), 20121' },
  { id: 'mock-2', label: 'Corso Buenos Aires 10, Milano', secondary: 'Milano (MI), 20124' },
  { id: 'mock-3', label: 'Piazza Duomo, Milano', secondary: 'Milano (MI), 20121' },
];

const PLACES: Record<string, ResolvedPlace> = {
  'mock-1': { address_raw: 'Via Roma 1, Milano', address_normalized: 'Via Roma 1, 20121 Milano MI', comune: 'Milano', cap: '20121', lat: 45.4642, lng: 9.19 },
  'mock-2': { address_raw: 'Corso Buenos Aires 10, Milano', address_normalized: 'Corso Buenos Aires 10, 20124 Milano MI', comune: 'Milano', cap: '20124', lat: 45.4781, lng: 9.2099 },
  'mock-3': { address_raw: 'Piazza Duomo, Milano', address_normalized: 'Piazza del Duomo, 20121 Milano MI', comune: 'Milano', cap: '20121', lat: 45.4641, lng: 9.1919 },
};

export class MockGeocodingProvider implements GeocodingProvider {
  async autocomplete(query: string): Promise<GeocodingSuggestion[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    return SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(q) || q.length >= 3);
  }

  async resolve(id: string): Promise<ResolvedPlace> {
    const place = PLACES[id] ?? PLACES['mock-1']!;
    return place;
  }
}
