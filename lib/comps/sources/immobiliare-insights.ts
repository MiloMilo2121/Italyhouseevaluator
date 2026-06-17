import type { RawListing } from '../normalize';
import type { CompsFetchParams, CompsSourceAdapter } from './types';
import { asRecord, bool, num, str } from './util';

/**
 * Adapter Immobiliare.it Insights. Dati di mercato/transazione ⇒ source 'agency'
 * (prezzi di chiusura: NIENTE sconto offerta→rogito). Stesso shape di adapter
 * (client `fetch` iniettabile + mapping puro). API reale validata in deploy;
 * mapping difensivo testato su fixture.
 */

type FetchImpl = typeof fetch;

export interface ImmobiliareInsightsOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  fetchImpl?: FetchImpl;
}

export const IMMOBILIARE_PORTAL = 'immobiliare_insights';

/** Item Immobiliare.it Insights → RawListing (source 'agency': dato transazionale). */
export function extractImmobiliareInsights(item: unknown): RawListing | null {
  const it = asRecord(item);
  const id = str(it['id'], it['transactionId'], it['listingId'], it['uuid']);
  if (id == null) return null;
  const geo = asRecord(it['geo'] ?? it['location'] ?? it['coordinates']);
  return {
    listingId: id,
    portal: IMMOBILIARE_PORTAL,
    source: 'agency',
    price: num(it['price'], it['closingPrice'], it['transactionPrice'], it['value']),
    superficieMq: num(it['surface'], it['area'], it['sqm'], it['size']),
    lat: num(it['latitude'], it['lat'], geo['lat'], geo['latitude']),
    lng: num(it['longitude'], it['lng'], geo['lng'], geo['longitude']),
    comuneCode: str(it['municipalityCode'], it['istatCode'], it['comuneCode']),
    propertyType: str(it['propertyType'], it['category'], it['typology']),
    stato: str(it['condition'], it['state'], it['conservation']),
    piano: num(it['floor']),
    ascensore: bool(it['elevator'], it['hasLift']),
    classeEnergetica: str(it['energyClass'], it['energyRating']),
    listingDate: str(it['transactionDate'], it['date'], it['closingDate']),
  };
}

export class ImmobiliareInsightsAdapter implements CompsSourceAdapter {
  readonly id = IMMOBILIARE_PORTAL;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: ImmobiliareInsightsOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://insights.immobiliare.it/api';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async fetchListings(params: CompsFetchParams): Promise<unknown[]> {
    const url = new URL(this.baseUrl);
    if (params.lat != null) url.searchParams.set('lat', String(params.lat));
    if (params.lng != null) url.searchParams.set('lng', String(params.lng));
    if (params.radiusMeters != null) url.searchParams.set('radius', String(params.radiusMeters));
    if (params.comune) url.searchParams.set('comune', params.comune);
    url.searchParams.set('limit', String(params.limit ?? 50));

    const res = await this.fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Immobiliare Insights ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as unknown;
    const root = asRecord(json);
    const list = json && Array.isArray(json) ? json : root['results'] ?? root['transactions'] ?? root['items'];
    return Array.isArray(list) ? list : [];
  }

  extract(item: unknown): RawListing | null {
    return extractImmobiliareInsights(item);
  }
}
