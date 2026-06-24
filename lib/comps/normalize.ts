import type { CompSource, OmiStato } from '@/lib/valuation/types';
import { round2 } from '@/lib/valuation/util';

/**
 * Normalizzazione comparabili (V2), PURA. Lavora su un `RawListing`
 * portal-agnostico (l'estrazione portale-specifica Immobiliare/Idealista è in
 * apify.ts). Produce righe pronte per la tabella `comps` + dedup + filtro
 * outlier. Lo sconto offerta→rogito NON è applicato qui: è nel motore
 * (`adjustedEurMq`, source-aware) per non scontare due volte.
 */

export interface RawListing {
  listingId: string;
  /** Etichetta sorgente (anche namespacing del listing_id): 'immobiliare'|'idealista'|'idealista_data'|… */
  portal: string;
  price: number | null;
  superficieMq: number | null;
  lat: number | null;
  lng: number | null;
  comuneCode?: string | null;
  propertyType?: string | null;
  stato?: string | null;
  piano?: number | null;
  ascensore?: boolean | null;
  classeEnergetica?: string | null;
  // Attributi per la stima edonica / similarità (Fase 2).
  locali?: number | null;
  hasTerrazzo?: boolean | null;
  hasBalcone?: boolean | null;
  listingDate?: string | null; // ISO
  /** Origine prezzo: omesso ⇒ 'annuncio' (offerta, scontata). I dati transazionali
   *  ufficiali (rogiti/agency) la impostano a 'agency'/'rogito' ⇒ niente sconto. */
  source?: CompSource;
}

export interface NormalizedComp {
  listing_id: string;
  source: CompSource;
  lat: number;
  lng: number;
  comune_code: string | null;
  property_type: string | null;
  superficie_mq: number;
  superficie_commerciale_mq: number;
  stato: OmiStato | null;
  price: number;
  eur_mq: number; // prezzo di OFFERTA grezzo (lo sconto è nel motore)
  sale_date: string;
  piano: number | null;
  ascensore: boolean | null;
  classe_energetica: string | null;
  locali: number | null;
  attributes: Record<string, unknown>;
}

function mapStato(raw: string | null | undefined): OmiStato | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (/nuov|ottim|ristrutturat/.test(s)) return 'Ottimo';
  if (/buono|abitabile|normal/.test(s)) return 'Normale';
  if (/ristruttur|scadent|da ristr/.test(s)) return 'Scadente';
  return null;
}

const EUR_MQ_MIN = 200;
const EUR_MQ_MAX = 20000;

/** RawListing → NormalizedComp; null se mancano dati essenziali o €/mq fuori scala. */
export function normalizeListing(raw: RawListing): NormalizedComp | null {
  if (raw.price == null || raw.price <= 0) return null;
  if (raw.superficieMq == null || raw.superficieMq <= 0) return null;
  if (raw.lat == null || raw.lng == null) return null;
  const eurMq = round2(raw.price / raw.superficieMq);
  if (eurMq < EUR_MQ_MIN || eurMq > EUR_MQ_MAX) return null;

  return {
    listing_id: `${raw.portal}:${raw.listingId}`,
    source: raw.source ?? 'annuncio',
    lat: raw.lat,
    lng: raw.lng,
    comune_code: raw.comuneCode ?? null,
    property_type: raw.propertyType ?? null,
    superficie_mq: raw.superficieMq,
    superficie_commerciale_mq: raw.superficieMq, // affinabile con coeff. pertinenze
    stato: mapStato(raw.stato),
    price: raw.price,
    eur_mq: eurMq,
    sale_date: raw.listingDate ?? new Date().toISOString().slice(0, 10),
    piano: raw.piano ?? null,
    ascensore: raw.ascensore ?? null,
    classe_energetica: raw.classeEnergetica ?? null,
    locali: raw.locali ?? null,
    attributes: {
      portal: raw.portal,
      ...(raw.locali != null ? { locali: raw.locali } : {}),
      ...(raw.hasTerrazzo != null ? { terrazzo: raw.hasTerrazzo } : {}),
      ...(raw.hasBalcone != null ? { balcone: raw.hasBalcone } : {}),
    },
  };
}

/** Dedup per listing_id e per cluster geo+superficie (stessa unità su più portali). */
export function dedupComps(comps: NormalizedComp[]): NormalizedComp[] {
  const byId = new Set<string>();
  const byCluster = new Set<string>();
  const out: NormalizedComp[] = [];
  for (const c of comps) {
    if (byId.has(c.listing_id)) continue;
    const cluster = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}|${Math.round(c.superficie_mq / 5) * 5}`;
    if (byCluster.has(cluster)) continue;
    byId.add(c.listing_id);
    byCluster.add(cluster);
    out.push(c);
  }
  return out;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
}

/** Filtro outlier IQR sui €/mq (Tukey 1.5·IQR). <4 comp ⇒ nessun filtro. */
export function filterOutliers(comps: NormalizedComp[]): NormalizedComp[] {
  if (comps.length < 4) return comps;
  const sorted = comps.map((c) => c.eur_mq).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return comps.filter((c) => c.eur_mq >= lo && c.eur_mq <= hi);
}

/** Pipeline pura: normalizza, scarta i null, dedup, filtra outlier. */
export function normalizeListings(raw: RawListing[]): NormalizedComp[] {
  const normalized = raw
    .map(normalizeListing)
    .filter((c): c is NormalizedComp => c !== null);
  return filterOutliers(dedupComps(normalized));
}
