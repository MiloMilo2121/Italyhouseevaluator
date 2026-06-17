import type { RawListing } from '../normalize';
import { extractIdealistaData, IdealistaDataAdapter } from './idealista';
import { extractImmobiliareInsights, ImmobiliareInsightsAdapter } from './immobiliare-insights';
import type { CompsSourceAdapter } from './types';

/**
 * Registry estensibile delle fonti ufficiali. Aggiungere una fonte = importare il
 * suo adapter/extractor e aggiungere un case qui (predisposizione richiesta).
 * 'apify' resta gestita dal path esistente (ingest:comps/webhook), non qui.
 */

/** Solo i campi env necessari (così il registry è testabile senza tutto ServerEnv). */
export interface CompsSourceEnv {
  IDEALISTA_DATA_API_KEY?: string | undefined;
  IDEALISTA_DATA_BASE_URL?: string | undefined;
  IMMOBILIARE_INSIGHTS_API_KEY?: string | undefined;
  IMMOBILIARE_INSIGHTS_BASE_URL?: string | undefined;
}

/** Adapter live (client + mapping). null se la fonte è sconosciuta o non configurata. */
export function createCompsSourceAdapter(id: string, env: CompsSourceEnv): CompsSourceAdapter | null {
  switch (id) {
    case 'idealista_data':
      return env.IDEALISTA_DATA_API_KEY
        ? new IdealistaDataAdapter({ apiKey: env.IDEALISTA_DATA_API_KEY, baseUrl: env.IDEALISTA_DATA_BASE_URL })
        : null;
    case 'immobiliare_insights':
      return env.IMMOBILIARE_INSIGHTS_API_KEY
        ? new ImmobiliareInsightsAdapter({
            apiKey: env.IMMOBILIARE_INSIGHTS_API_KEY,
            baseUrl: env.IMMOBILIARE_INSIGHTS_BASE_URL,
          })
        : null;
    default:
      return null;
  }
}

/** Solo il mapping puro (per dry-run su file fixture, senza chiavi/rete). */
export function getCompsExtractor(id: string): ((item: unknown) => RawListing | null) | null {
  switch (id) {
    case 'idealista_data':
      return extractIdealistaData;
    case 'immobiliare_insights':
      return extractImmobiliareInsights;
    default:
      return null;
  }
}
