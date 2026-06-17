import { getServerEnv } from '@/lib/env';
import { AnthropicReconciler } from './anthropic-reconciler';
import { AnthropicVisionExtractor } from './anthropic-vision';
import { CatastoOpenApiProvider } from './catasto-openapi';
import { NullCatastoProvider, NullReconciler, NullTranscriber, NullVisionExtractor } from './null';
import { OpenAiTranscriber } from './openai-whisper';
import type { CatastoProvider, DocumentReconciler, DocumentVisionExtractor, Transcriber } from './types';

/**
 * Selettori dei port documenti (specchio di `createNarrator`). Con le chiavi
 * configurate ⇒ adapter reale; senza ⇒ Null* che degrada (estrazione = null,
 * pipeline inerte). Vision + reconciler riusano ANTHROPIC_API_KEY.
 */

export function createVisionExtractor(): DocumentVisionExtractor {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicVisionExtractor(env.ANTHROPIC_API_KEY, env.VISION_MODEL, env.VISION_PARSE_MODE);
  }
  return new NullVisionExtractor();
}

export function createReconciler(): DocumentReconciler {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicReconciler(env.ANTHROPIC_API_KEY, env.RECONCILER_MODEL);
  }
  return new NullReconciler();
}

export function createTranscriber(): Transcriber {
  const env = getServerEnv();
  if (env.OPENAI_API_KEY) {
    return new OpenAiTranscriber({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      model: env.WHISPER_MODEL,
    });
  }
  return new NullTranscriber();
}

export function createCatastoProvider(): CatastoProvider {
  const env = getServerEnv();
  if (env.CATASTO_BASE_URL && env.CATASTO_API_KEY) {
    return new CatastoOpenApiProvider({ baseUrl: env.CATASTO_BASE_URL, apiKey: env.CATASTO_API_KEY });
  }
  return new NullCatastoProvider();
}
