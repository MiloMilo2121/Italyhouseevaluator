import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import {
  APE_INSTRUCTION,
  APE_JSON_SCHEMA,
  APE_SYSTEM,
  ApeSchema,
  PLANIMETRIA_INSTRUCTION,
  PLANIMETRIA_JSON_SCHEMA,
  PLANIMETRIA_SYSTEM,
  PlanimetriaSchema,
} from './prompt';
import type { ApeExtraction, DocumentFile, DocumentVisionExtractor, PlanimetriaExtraction } from './types';

/**
 * Estrattore vision via Claude (@anthropic-ai/sdk), stesso pattern del Narrator:
 * `messages.parse` + `jsonSchemaOutputFormat` + ri-validazione zod → null in
 * degrado. Il content block immagine/PDF è assemblato qui (la logica testuale
 * resta pura in prompt.ts).
 *
 * `VISION_PARSE_MODE='create'` attiva un fallback difensivo: `messages.create`
 * senza structured output + JSON.parse del testo (utile se il combo
 * PDF+structured output dovesse comportarsi diversamente lato server). Default
 * 'parse'. Gated su ANTHROPIC_API_KEY (factory).
 */

export const DEFAULT_VISION_MODEL = 'claude-opus-4-8';

type ParseMode = 'parse' | 'create';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function sourceBlock(file: DocumentFile): unknown {
  if (file.mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } };
  }
  const media = IMAGE_MIME.has(file.mime) ? file.mime : 'image/png';
  return { type: 'image', source: { type: 'base64', media_type: media, data: file.data } };
}

function extractJson(resp: Anthropic.Message): unknown {
  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return null;
  let text = block.text.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export class AnthropicVisionExtractor implements DocumentVisionExtractor {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_VISION_MODEL,
    private readonly parseMode: ParseMode = 'parse',
  ) {
    this.client = new Anthropic({ apiKey });
  }

  private async run(
    system: string,
    instruction: string,
    schema: Parameters<typeof jsonSchemaOutputFormat>[0],
    file: DocumentFile,
  ): Promise<unknown> {
    const text =
      this.parseMode === 'create'
        ? `${instruction}\nRispondi SOLO con un oggetto JSON valido conforme allo schema atteso, senza testo aggiuntivo.`
        : instruction;
    const content = [sourceBlock(file), { type: 'text', text }] as unknown as Anthropic.MessageParam['content'];

    if (this.parseMode === 'create') {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content }],
      });
      return extractJson(resp);
    }

    const resp = await this.client.messages.parse({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: jsonSchemaOutputFormat(schema) },
    });
    return resp.parsed_output;
  }

  async extractApe(file: DocumentFile): Promise<ApeExtraction | null> {
    const raw = await this.run(APE_SYSTEM, APE_INSTRUCTION, APE_JSON_SCHEMA, file);
    const parsed = ApeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async extractPlanimetria(file: DocumentFile): Promise<PlanimetriaExtraction | null> {
    const raw = await this.run(PLANIMETRIA_SYSTEM, PLANIMETRIA_INSTRUCTION, PLANIMETRIA_JSON_SCHEMA, file);
    const parsed = PlanimetriaSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
}
