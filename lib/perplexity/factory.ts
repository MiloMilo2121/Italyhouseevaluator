import { PerplexityZoneProvider } from './client';
import type { ZoneIntelligenceProvider } from '@/lib/valuation/ports';

/**
 * Crea il provider zone intelligence se PERPLEXITY_API_KEY è configurata,
 * altrimenti null (il layer non gira ⇒ valutazione su OMI+comps). Gating
 * coerente con narration/perizia (LLM opzionali, degrado pulito).
 */
export function createZoneIntelligenceProvider(): ZoneIntelligenceProvider | null {
  const apiKey = process.env['PERPLEXITY_API_KEY'];
  if (!apiKey) return null;
  const threshold = process.env['ZONE_OMI_DEVIATION_THRESHOLD'];
  return new PerplexityZoneProvider({
    apiKey,
    ...(process.env['PERPLEXITY_MODEL'] ? { model: process.env['PERPLEXITY_MODEL'] } : {}),
    ...(process.env['PERPLEXITY_BASE_URL'] ? { baseUrl: process.env['PERPLEXITY_BASE_URL'] } : {}),
    ...(threshold ? { deviationThreshold: Number(threshold) } : {}),
  });
}
