import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import {
  buildReconcilerUserContent,
  RECONCILER_JSON_SCHEMA,
  RECONCILER_SYSTEM,
  ReconciliationSchema,
} from './prompt';
import type { DocumentReconciler, ReconcilerInput, ReconciliationResult } from './types';

/**
 * Reconciler via Claude: confronta i dichiarati con i fatti documentali e
 * PROPONE override + dubbi (mai un prezzo). Text-only, stesso pattern del
 * Narrator (`messages.parse` + JSON schema + safeParse → null). Il guardrail
 * puro `applyReconciliation` filtra poi gli override prima di toccare il subject.
 */

export const DEFAULT_RECONCILER_MODEL = 'claude-opus-4-8';

export class AnthropicReconciler implements DocumentReconciler {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_RECONCILER_MODEL,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async reconcile(input: ReconcilerInput): Promise<ReconciliationResult | null> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2000,
      system: RECONCILER_SYSTEM,
      messages: [{ role: 'user', content: buildReconcilerUserContent(input) }],
      output_config: { format: jsonSchemaOutputFormat(RECONCILER_JSON_SCHEMA) },
    });
    const parsed = ReconciliationSchema.safeParse(response.parsed_output);
    return parsed.success ? (parsed.data as unknown as ReconciliationResult) : null;
  }
}
