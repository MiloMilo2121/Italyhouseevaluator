import { normalizeCatasto } from './normalize';
import type { CatastoData, CatastoProvider, CatastoQuery } from './types';

/**
 * Provider Catasto deterministico (HTTP, OpenAPI-style). Seam configurabile:
 * l'endpoint/auth/shape reali del provider sono validati sull'ambiente
 * deployato (come Apify/Google Places). Tutto il mapping del payload grezzo vive
 * in `normalizeCatasto` (puro, testato). Gated su CATASTO_BASE_URL+CATASTO_API_KEY.
 */

type FetchImpl = typeof fetch;

export interface CatastoOpenApiOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: FetchImpl;
}

export class CatastoOpenApiProvider implements CatastoProvider {
  private readonly fetchImpl: FetchImpl;
  constructor(private readonly opts: CatastoOpenApiOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async lookup(query: CatastoQuery): Promise<CatastoData | null> {
    if (!query.indirizzo && !query.comune) return null;
    const url = new URL(this.opts.baseUrl);
    if (query.indirizzo) url.searchParams.set('indirizzo', query.indirizzo);
    if (query.comune) url.searchParams.set('comune', query.comune);

    const res = await this.fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Catasto lookup ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    return normalizeCatasto(json);
  }
}
