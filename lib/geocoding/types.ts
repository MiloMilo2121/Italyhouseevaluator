/**
 * Astrazione del provider di geocoding/autocomplete (§3). Default Google Places,
 * sostituibile (Nominatim, Mock) via factory senza toccare il resto. Usata dal
 * proxy server-side `/api/geocoding` per non esporre la chiave al browser.
 */

export interface GeocodingSuggestion {
  id: string; // place id / identificatore opaco
  label: string; // testo principale
  secondary?: string; // testo secondario (es. città/CAP)
}

export interface ResolvedPlace {
  address_raw: string;
  address_normalized: string;
  comune: string | null;
  cap: string | null;
  lat: number;
  lng: number;
}

export interface GeocodingOptions {
  sessionToken?: string;
  lang?: string;
}

export interface GeocodingProvider {
  autocomplete(query: string, opts?: GeocodingOptions): Promise<GeocodingSuggestion[]>;
  resolve(id: string, opts?: GeocodingOptions): Promise<ResolvedPlace>;
}
