import type { RawListing } from './normalize';

/**
 * Adapter Apify (V2). Estrae `RawListing` portal-agnostici dagli item degli
 * actor Immobiliare.it / Idealista, e avvia/recupera run via API (async +
 * webhook; NO run-sync per il limite di 300s). Token via env, fetch iniettabile.
 * Non eseguito nei test (gated `APIFY_TOKEN`); la normalizzazione a valle è pura.
 */

const APIFY_BASE = 'https://api.apify.com/v2';

type Item = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}
function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'si', 'sì', 'yes', '1'].includes(s)) return true;
    if (['false', 'no', '0'].includes(s)) return false;
  }
  return null;
}
function path(obj: Item, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Item actor Immobiliare.it → RawListing (campi: analytics/topology/price/geography). */
export function extractImmobiliare(item: Item): RawListing | null {
  const id = str(item['id']) ?? str(path(item, 'analytics', 'id'));
  if (!id) return null;
  return {
    listingId: id,
    portal: 'immobiliare',
    price: num(path(item, 'price', 'raw')) ?? num(path(item, 'price', 'value')),
    superficieMq: num(path(item, 'topology', 'surface')) ?? num(item['superficie']),
    lat: num(path(item, 'geography', 'latitude')),
    lng: num(path(item, 'geography', 'longitude')),
    comuneCode: str(path(item, 'geography', 'comune')),
    propertyType: str(path(item, 'analytics', 'typology')) ?? str(item['tipologia']),
    stato: str(path(item, 'analytics', 'state')) ?? str(item['stato']),
    piano: num(path(item, 'topology', 'floor')),
    ascensore: typeof path(item, 'topology', 'elevator') === 'boolean' ? (path(item, 'topology', 'elevator') as boolean) : null,
    classeEnergetica: str(path(item, 'topology', 'energyClass')),
    locali: num(path(item, 'topology', 'rooms')) ?? num(item['locali']),
    hasTerrazzo: bool(path(item, 'topology', 'terrace')) ?? bool(item['terrazzo']),
    hasBalcone: bool(path(item, 'topology', 'balcony')) ?? bool(item['balcone']),
    listingDate: str(item['date']),
  };
}

/** Item actor Idealista → RawListing (campi: price/ubication/moreCharacteristics). */
export function extractIdealista(item: Item): RawListing | null {
  const id = str(item['adid']) ?? str(item['propertyCode']);
  if (!id) return null;
  return {
    listingId: id,
    portal: 'idealista',
    price: num(item['price']),
    superficieMq: num(path(item, 'moreCharacteristics', 'constructedArea')),
    lat: num(path(item, 'ubication', 'latitude')),
    lng: num(path(item, 'ubication', 'longitude')),
    comuneCode: str(path(item, 'ubication', 'administrativeAreaLevel4')),
    propertyType: str(item['propertyType']),
    stato: str(path(item, 'moreCharacteristics', 'status')),
    piano: num(path(item, 'moreCharacteristics', 'floor')),
    ascensore:
      typeof path(item, 'moreCharacteristics', 'lift') === 'boolean'
        ? (path(item, 'moreCharacteristics', 'lift') as boolean)
        : null,
    classeEnergetica: str(path(item, 'moreCharacteristics', 'energyCertification', 'type')),
    locali: num(path(item, 'moreCharacteristics', 'roomNumber')),
    hasTerrazzo: bool(path(item, 'moreCharacteristics', 'terrace')),
    hasBalcone: bool(path(item, 'moreCharacteristics', 'balcony')),
    listingDate: null,
  };
}

export function extract(item: Item, portal: 'immobiliare' | 'idealista'): RawListing | null {
  return portal === 'immobiliare' ? extractImmobiliare(item) : extractIdealista(item);
}

export interface ApifyClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
}

/** Client Apify minimale: avvio run async + recupero dataset items. */
export class ApifyClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: ApifyClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.opts.token}`, 'Content-Type': 'application/json' };
  }

  /** Avvia un run async dell'actor (no run-sync). Ritorna runId + datasetId. */
  async startRun(
    actorId: string,
    input: unknown,
    webhookUrl?: string,
  ): Promise<{ runId: string; datasetId: string }> {
    const url = new URL(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`);
    if (webhookUrl) {
      // webhook ACTOR.RUN.SUCCEEDED → il backend recupera il dataset
      url.searchParams.set('webhooks', encodeURIComponent(JSON.stringify([
        { eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl },
      ])));
    }
    const res = await this.fetchImpl(url.toString(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Apify startRun HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { id?: string; defaultDatasetId?: string } };
    return { runId: json.data?.id ?? '', datasetId: json.data?.defaultDatasetId ?? '' };
  }

  async fetchDatasetItems(datasetId: string): Promise<Item[]> {
    const res = await this.fetchImpl(`${APIFY_BASE}/datasets/${datasetId}/items?clean=true&format=json`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Apify fetchDataset HTTP ${res.status}`);
    return (await res.json()) as Item[];
  }
}
