import type { RawListing } from '../normalize';
import type { CompsFetchParams, CompsSourceAdapter } from './types';
import { asRecord, bool, num, str } from './util';

/**
 * Adapter idealista/data (annunci individuali → tabella comps). Prezzi di
 * OFFERTA ⇒ source resta 'annuncio' (lo sconto offerta→rogito si applica nel
 * motore). Client `fetch` iniettabile come ApifyClient; base URL/auth da env.
 * Lo shape esatto dell'API è un seam validato in deploy: il mapping è difensivo
 * (alias multipli) e testato su fixture controllata.
 */

type FetchImpl = typeof fetch;

export interface IdealistaDataOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  fetchImpl?: FetchImpl;
}

export const IDEALISTA_PORTAL = 'idealista_data';

/** Item idealista/data → RawListing (source 'annuncio' implicito). */
export function extractIdealistaData(item: unknown): RawListing | null {
  const it = asRecord(item);
  const id = str(it['propertyCode'], it['id'], it['listingId'], it['adid']);
  if (id == null) return null;
  return {
    listingId: id,
    portal: IDEALISTA_PORTAL,
    price: num(it['price'], asRecord(it['priceInfo'])['amount'], it['priceAmount']),
    superficieMq: num(it['size'], it['builtArea'], it['surface'], it['sizeArea']),
    lat: num(it['latitude'], it['lat']),
    lng: num(it['longitude'], it['lng']),
    comuneCode: str(it['municipalityCode'], it['comuneCode']),
    propertyType: str(it['propertyType'], it['detailedType'], it['typology']),
    stato: str(it['status'], it['condition'], it['conservation']),
    piano: num(it['floor']),
    ascensore: bool(it['hasLift'], it['elevator']),
    classeEnergetica: str(asRecord(it['energyCertification'])['energyClass'], it['energyClass'], it['energyRating']),
    listingDate: str(it['date'], it['publicationDate'], it['modificationDate']),
  };
}

export class IdealistaDataAdapter implements CompsSourceAdapter {
  readonly id = IDEALISTA_PORTAL;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: IdealistaDataOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.idealista.com/data';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async fetchListings(params: CompsFetchParams): Promise<unknown[]> {
    const url = new URL(this.baseUrl);
    if (params.lat != null && params.lng != null) url.searchParams.set('center', `${params.lat},${params.lng}`);
    if (params.radiusMeters != null) url.searchParams.set('distance', String(params.radiusMeters));
    if (params.comune) url.searchParams.set('locationName', params.comune);
    url.searchParams.set('maxItems', String(params.limit ?? 50));

    const res = await this.fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`idealista/data ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as unknown;
    const root = asRecord(json);
    const list = json && Array.isArray(json) ? json : root['elementList'] ?? root['results'] ?? root['items'];
    return Array.isArray(list) ? list : [];
  }

  extract(item: unknown): RawListing | null {
    return extractIdealistaData(item);
  }
}
