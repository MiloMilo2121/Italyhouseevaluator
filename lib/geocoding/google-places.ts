import type {
  GeocodingOptions,
  GeocodingProvider,
  GeocodingSuggestion,
  ResolvedPlace,
} from './types';

/**
 * Provider Google Places API (New) v1. `fetch` e `key` iniettati ⇒ testabile.
 * - autocomplete: POST https://places.googleapis.com/v1/places:autocomplete
 * - resolve:      GET  https://places.googleapis.com/v1/places/{id}
 * Per il GET su singolo place la field mask usa nomi "bare" (location,…).
 */

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { secondaryText?: { text?: string } };
    };
  }[];
}

interface PlaceDetailsResponse {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { types?: string[]; longText?: string; shortText?: string }[];
}

export class GooglePlacesProvider implements GeocodingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async autocomplete(query: string, opts?: GeocodingOptions): Promise<GeocodingSuggestion[]> {
    const res = await this.fetchImpl(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey },
      body: JSON.stringify({
        input: query,
        languageCode: opts?.lang ?? 'it',
        includedRegionCodes: ['it'],
        ...(opts?.sessionToken ? { sessionToken: opts.sessionToken } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Places autocomplete HTTP ${res.status}`);
    const data = (await res.json()) as AutocompleteResponse;
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => p?.placeId != null)
      .map((p) => ({
        id: p.placeId!,
        label: p.text?.text ?? '',
        ...(p.structuredFormat?.secondaryText?.text
          ? { secondary: p.structuredFormat.secondaryText.text }
          : {}),
      }));
  }

  async resolve(id: string, opts?: GeocodingOptions): Promise<ResolvedPlace> {
    const url = new URL(DETAILS_URL + encodeURIComponent(id));
    if (opts?.sessionToken) url.searchParams.set('sessionToken', opts.sessionToken);
    const res = await this.fetchImpl(url.toString(), {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'location,formattedAddress,addressComponents',
      },
    });
    if (!res.ok) throw new Error(`Places details HTTP ${res.status}`);
    const data = (await res.json()) as PlaceDetailsResponse;

    const comp = (type: string): string | null =>
      data.addressComponents?.find((c) => c.types?.includes(type))?.longText ?? null;

    const formatted = data.formattedAddress ?? '';
    return {
      address_raw: formatted,
      address_normalized: formatted,
      comune: comp('administrative_area_level_3') ?? comp('locality'),
      cap: comp('postal_code'),
      lat: data.location?.latitude ?? 0,
      lng: data.location?.longitude ?? 0,
    };
  }
}
