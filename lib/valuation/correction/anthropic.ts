import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { CORRECTION_JSON_SCHEMA, CORRECTION_SYSTEM, RawCorrectionSchema, buildCorrectionUserContent } from './prompt';
import type { BoundedCorrector, CorrectionRequest, RawCorrection } from '../ports';

/**
 * Corrector via Claude (@anthropic-ai/sdk), structured output come narration.
 * Ritorna SOLO il fattore proposto + motivazione; il clamp/applicazione è puro
 * (clamp.ts). Qualunque problema ⇒ null (nessuna correzione). Modello default
 * sonnet (correzione leggera), gated su ANTHROPIC_API_KEY + CORRECTION_ENABLED.
 */

export const DEFAULT_CORRECTION_MODEL = 'claude-sonnet-4-6';

export class AnthropicBoundedCorrector implements BoundedCorrector {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    public readonly model: string = DEFAULT_CORRECTION_MODEL,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async correct(req: CorrectionRequest): Promise<RawCorrection | null> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 400,
        system: CORRECTION_SYSTEM,
        messages: [{ role: 'user', content: buildCorrectionUserContent(req) }],
        output_config: { format: jsonSchemaOutputFormat(CORRECTION_JSON_SCHEMA) },
      });
      const parsed = RawCorrectionSchema.safeParse(response.parsed_output);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
