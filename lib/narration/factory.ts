import { getServerEnv } from '@/lib/env';
import { AnthropicNarrator } from './anthropic';
import type { Narrator, NarrationInput, ValuationNarrative } from './types';

/**
 * Selettore del narratore. Con `ANTHROPIC_API_KEY` ⇒ Claude; senza chiave ⇒
 * `NullNarrator`, che degrada (nessuna narrazione): il report mostra solo i
 * numeri deterministici. Così la dashboard gira anche senza credenziali LLM.
 */

export class NullNarrator implements Narrator {
  async narrate(_input: NarrationInput): Promise<ValuationNarrative | null> {
    return null;
  }
}

export function createNarrator(): Narrator {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicNarrator(env.ANTHROPIC_API_KEY, env.NARRATION_MODEL);
  }
  return new NullNarrator();
}
