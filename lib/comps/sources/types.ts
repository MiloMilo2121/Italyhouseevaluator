import type { RawListing } from '../normalize';

/**
 * Seam ESTENSIBILE delle fonti comparabili (V2 Step 5). Ogni fonte ufficiale è
 * un adapter: client HTTP (`fetchListings`) + mapping puro (`extract`) verso il
 * `RawListing` portal-agnostico. Aggiungere una fonte = un nuovo file adapter +
 * 1 entry nel registry. Retrieval (`comps_near`) e motore restano invariati.
 */

export type CompsSourceId = 'apify' | 'idealista_data' | 'immobiliare_insights' | (string & {});

export interface CompsFetchParams {
  lat?: number | undefined;
  lng?: number | undefined;
  radiusMeters?: number | undefined;
  comune?: string | undefined;
  limit?: number | undefined;
  months?: number | undefined;
}

export interface CompsSourceAdapter {
  readonly id: string;
  /** Recupera gli item grezzi dalla fonte (rete; gated/validato in deploy). */
  fetchListings(params: CompsFetchParams): Promise<unknown[]>;
  /** Mapping PURO item grezzo → RawListing (testato su fixture). */
  extract(item: unknown): RawListing | null;
}
