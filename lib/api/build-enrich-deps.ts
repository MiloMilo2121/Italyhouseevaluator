import type { SupabaseClient } from '@supabase/supabase-js';
import { loadActiveCoefficientSet } from '@/lib/db/coefficient-sets';
import { SupabaseOmiQueryClient, type SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { OmiResolverImpl } from '@/lib/omi/resolver';
import { emptyComparablesProvider } from '@/lib/valuation/comparables-empty';
import { SupabaseComparablesProvider } from '@/lib/valuation/comparables-supabase';
import { createZoneIntelligenceProvider } from '@/lib/perplexity/factory';
import { createBoundedCorrector, correctionParamsFromEnv } from '@/lib/valuation/correction/factory';
import type { EnrichDeps } from '@/lib/valuation/enrich';

/**
 * Assembla le dipendenze di `enrich` (coefficient set attivo + resolver OMI +
 * provider comparabili dietro flag COMPS_ENABLED) da un client Supabase. Stesso
 * cablaggio della route /api/valutazione, riusato dal re-enrich documentale
 * (route /api/documenti/process e script), così non si duplica la costruzione.
 */
export async function buildEnrichDeps(client: SupabaseClient): Promise<EnrichDeps> {
  const rpcClient = client as unknown as SupabaseRpcClient;
  const comparablesProvider =
    process.env['COMPS_ENABLED'] === 'true'
      ? new SupabaseComparablesProvider(rpcClient)
      : emptyComparablesProvider;
  // Fase 3/4: gated. Assenti ⇒ enrich resta OMI+comps (degrado pulito).
  const zoneIntelligenceProvider = createZoneIntelligenceProvider();
  const boundedCorrector = createBoundedCorrector();
  return {
    coefficientSet: await loadActiveCoefficientSet(client),
    omiResolver: new OmiResolverImpl(new SupabaseOmiQueryClient(rpcClient)),
    comparablesProvider,
    correctionParams: correctionParamsFromEnv(),
    ...(zoneIntelligenceProvider ? { zoneIntelligenceProvider } : {}),
    ...(boundedCorrector ? { boundedCorrector } : {}),
  };
}
