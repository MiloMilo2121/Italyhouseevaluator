import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { buildPeriziaUserContent, PERIZIA_JSON_SCHEMA, PERIZIA_SYSTEM, PeriziaSchema } from './prompt';
import type { DocumentAttachment, PeriziaInput, PeriziaSections, PeriziaWriter } from './types';

/**
 * Perizia via Claude long-context. UNA passata che "carica tutto una volta": il
 * dossier serializzato + i documenti sorgente allegati (planimetria/APE come
 * image/document block). `messages.parse` + jsonSchemaOutputFormat + safeParse
 * → null in degrado (stesso pattern di narrazione/vision). Opus (1M context).
 * Gated su ANTHROPIC_API_KEY (factory).
 */

export const DEFAULT_PERIZIA_MODEL = 'claude-opus-4-8';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function attachmentBlock(a: DocumentAttachment): unknown {
  if (a.mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } };
  }
  const media = IMAGE_MIME.has(a.mime) ? a.mime : 'image/png';
  return { type: 'image', source: { type: 'base64', media_type: media, data: a.data } };
}

export class AnthropicPeriziaWriter implements PeriziaWriter {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_PERIZIA_MODEL,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async write(input: PeriziaInput, attachments: DocumentAttachment[] = []): Promise<PeriziaSections | null> {
    const blocks = attachments.map(attachmentBlock);
    const content = [
      ...blocks,
      { type: 'text', text: buildPeriziaUserContent(input) },
    ] as unknown as Anthropic.MessageParam['content'];

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 8000,
      system: PERIZIA_SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { format: jsonSchemaOutputFormat(PERIZIA_JSON_SCHEMA) },
    });
    const parsed = PeriziaSchema.safeParse(response.parsed_output);
    return parsed.success ? parsed.data : null;
  }
}
