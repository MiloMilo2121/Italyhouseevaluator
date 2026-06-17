import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { NARRATION_SYSTEM, NARRATIVE_JSON_SCHEMA, NarrativeSchema, buildNarrationUserContent } from './prompt';
import type { Narrator, NarrationInput, ValuationNarrative } from './types';

/**
 * Narratore via Claude (@anthropic-ai/sdk). Structured output con
 * `messages.parse` + `jsonSchemaOutputFormat(NARRATIVE_JSON_SCHEMA)`: l'SDK
 * popola `parsed_output`, che ri-validiamo con `NarrativeSchema` (zod v3) —
 * se manca o è malformato degradiamo a null e il report resta sui soli numeri.
 * (Si usa il JSON schema e non `zodOutputFormat` perché quest'ultimo richiede
 * zod v4, mentre il progetto è su zod v3.)
 *
 * Default del modello: `claude-sonnet-4-6` (buona prosa IT, costo < Opus),
 * sovrascrivibile via env `NARRATION_MODEL`. Gated su `ANTHROPIC_API_KEY`.
 */

export const DEFAULT_NARRATION_MODEL = 'claude-sonnet-4-6';

export class AnthropicNarrator implements Narrator {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_NARRATION_MODEL,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async narrate(input: NarrationInput): Promise<ValuationNarrative | null> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 1500,
      system: NARRATION_SYSTEM,
      messages: [{ role: 'user', content: buildNarrationUserContent(input) }],
      output_config: { format: jsonSchemaOutputFormat(NARRATIVE_JSON_SCHEMA) },
    });
    const parsed = NarrativeSchema.safeParse(response.parsed_output);
    return parsed.success ? parsed.data : null;
  }
}
