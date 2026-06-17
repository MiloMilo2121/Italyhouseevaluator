import { getServerEnv } from '@/lib/env';
import { AnthropicPeriziaWriter } from './anthropic';
import { NullPeriziaWriter } from './null';
import type { PeriziaWriter } from './types';

/** Selettore del writer (specchio di createNarrator): Claude se key, altrimenti Null. */
export function createPeriziaWriter(): PeriziaWriter {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicPeriziaWriter(env.ANTHROPIC_API_KEY, env.PERIZIA_MODEL);
  }
  return new NullPeriziaWriter();
}
