import type {
  GeocodingOptions,
  GeocodingProvider,
  GeocodingSuggestion,
  ResolvedPlace,
} from './types';

/**
 * Provider Nominatim (OpenStreetMap), keyless. Implementazione sottile che
 * prova la sostituibilità del seam. La search ritorna già lat/lon, quindi il
 * dato risolto viene impacchettato nell'`id` del suggerimento e `resolve` lo
 * decodifica (nessuna seconda chiamata). Rispettare la usage policy (User-Agent).
 */

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

function packId(place: ResolvedPlace): string {
  return encodeURIComponent(JSON.stringify(place));
}

export class NominatimProvider implements GeocodingProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async autocomplete(query: string, opts?: GeocodingOptions): Promise<GeocodingSuggestion[]> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'it');
    url.searchParams.set('limit', '5');
    url.searchParams.set('accept-language', opts?.lang ?? 'it');

    const res = await this.fetchImpl(url.toString(), {
      headers: { 'User-Agent': 'ValutatoreImmobiliareDelfino/1.0' },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const items = (await res.json()) as NominatimItem[];

    return items.map((it) => {
      const comune = it.address?.city ?? it.address?.town ?? it.address?.village ?? it.address?.municipality ?? null;
      const place: ResolvedPlace = {
        address_raw: it.display_name,
        address_normalized: it.display_name,
        comune,
        cap: it.address?.postcode ?? null,
        lat: Number(it.lat),
        lng: Number(it.lon),
      };
      return {
        id: packId(place),
        label: it.display_name,
        ...(comune ? { secondary: comune } : {}),
      };
    });
  }

  async resolve(id: string): Promise<ResolvedPlace> {
    return JSON.parse(decodeURIComponent(id)) as ResolvedPlace;
  }
}
