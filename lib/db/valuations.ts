import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import type { LeadInput } from '@/lib/schemas/valuation-request.schema';
import type { EnrichResult } from '@/lib/valuation/types';
import type {
  PersistResult,
  RequestPersistInput,
  ValuationPersistence,
} from '@/lib/api/ports';

/**
 * Adapter Supabase di ValuationPersistence. La creazione lead+request passa per
 * l'RPC transazionale `create_valuation_request` (atomica, dedup, geom); l'update
 * dell'enrichment è una update PostgREST.
 */

/** Mapper PURO: EnrichResult → colonne di valuation_requests. */
export function enrichResultToUpdate(r: EnrichResult): Record<string, unknown> {
  return {
    superficie_commerciale_mq: r.superficie_commerciale_mq,
    zona_omi_id: r.zona_omi_id,
    fallback_level: r.fallback_level,
    omi_eur_mq_min: r.omi_eur_mq_min,
    omi_eur_mq_max: r.omi_eur_mq_max,
    coefficients_applied: r.coefficients_applied,
    estimate_min: r.estimate_min,
    estimate_max: r.estimate_max,
    confidence_score: r.confidence.score,
    confidence_label: r.confidence.label,
    confidence_fsd: r.confidence.fsd,
    breakdown: r.breakdown,
    comparables: r.comparables,
    zone_intelligence: r.zone_intelligence ?? null,
    correction: r.correction ?? null,
    estimate_deterministic_min: r.estimate_deterministic_min ?? null,
    estimate_deterministic_max: r.estimate_deterministic_max ?? null,
    valuation_status: 'enriched',
    updated_at: new Date().toISOString(),
  };
}

interface RpcResult {
  reference_id: string;
  created: boolean;
}

export class SupabaseValuationPersistence implements ValuationPersistence {
  constructor(private readonly client: SupabaseClient) {}

  async createLeadAndRequest(lead: LeadInput, request: RequestPersistInput): Promise<PersistResult> {
    const rpc = this.client as unknown as SupabaseRpcClient;
    const { data, error } = await rpc.rpc('create_valuation_request', {
      p_lead: lead,
      p_request: request,
    });
    if (error) throw new Error(`create_valuation_request fallita: ${error.message}`);
    const res = data as RpcResult;
    return { referenceId: res.reference_id, created: res.created };
  }

  async updateEnrichment(referenceId: string, result: EnrichResult): Promise<void> {
    const { error } = await this.client
      .from('valuation_requests')
      .update(enrichResultToUpdate(result))
      .eq('reference_id', referenceId);
    if (error) throw new Error(`updateEnrichment fallita: ${error.message}`);
  }
}
