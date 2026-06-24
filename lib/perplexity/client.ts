import {
  RawZoneResearchSchema,
  ZONE_RESEARCH_JSON_SCHEMA,
  ZONE_RESEARCH_SYSTEM,
  buildZoneResearchUserContent,
  normalizeZoneIntelligence,
} from './prompt';
import type { ZoneIntelligenceProvider, ZoneIntelligenceQuery } from '@/lib/valuation/ports';
import type { ZoneIntelligence } from '@/lib/valuation/types';

/**
 * Provider zone intelligence via Perplexity (API OpenAI-compatible
 * /chat/completions con `response_format` json_schema). `fetch` iniettabile.
 * Difensivo: qualunque errore (rete, schema, parsing) ⇒ null e la valutazione
 * resta OMI+comps (degrado pulito). Gated dal factory su PERPLEXITY_API_KEY.
 */

export const DEFAULT_PERPLEXITY_MODEL = 'sonar-pro';
const DEFAULT_BASE_URL = 'https://api.perplexity.ai';
const DEFAULT_DEVIATION_THRESHOLD = 0.1;

export interface PerplexityOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  deviationThreshold?: number;
  fetchImpl?: typeof fetch;
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

export class PerplexityZoneProvider implements ZoneIntelligenceProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly deviationThreshold: number;

  constructor(private readonly opts: PerplexityOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.model = opts.model || DEFAULT_PERPLEXITY_MODEL;
    this.baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
    this.deviationThreshold = opts.deviationThreshold ?? DEFAULT_DEVIATION_THRESHOLD;
  }

  async research(q: ZoneIntelligenceQuery): Promise<ZoneIntelligence | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: ZONE_RESEARCH_SYSTEM },
            { role: 'user', content: buildZoneResearchUserContent(q) },
          ],
          response_format: { type: 'json_schema', json_schema: { schema: ZONE_RESEARCH_JSON_SCHEMA } },
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ChatResponse;
      const content = json.choices?.[0]?.message?.content;
      const obj = typeof content === 'string' ? JSON.parse(content) : content;
      const parsed = RawZoneResearchSchema.safeParse(obj);
      if (!parsed.success) return null;
      return normalizeZoneIntelligence(parsed.data, q, {
        deviationThreshold: this.deviationThreshold,
        model: this.model,
        retrievedAt: new Date().toISOString(),
      });
    } catch {
      return null;
    }
  }
}
