import { AnthropicBoundedCorrector } from './anthropic';
import type { BoundedCorrector } from '../ports';
import type { CorrectionParams } from '../types';

/**
 * Correzione del valore: DOPPIO GATE — ANTHROPIC_API_KEY (riusata) + flag
 * esplicito CORRECTION_ENABLED, perché correggere il valore è più delicato della
 * sola prosa. Senza ⇒ null (nessuna correzione). Parametri (clamp, requireZoneIntel)
 * da env con default sicuri.
 */

export const DEFAULT_CORRECTION_PARAMS: CorrectionParams = {
  enabled: false,
  clampMaxPct: 0.06, // ±6%
  requireZoneIntel: true,
};

export function createBoundedCorrector(): BoundedCorrector | null {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey || process.env['CORRECTION_ENABLED'] !== 'true') return null;
  const model = process.env['CORRECTION_MODEL'];
  return model ? new AnthropicBoundedCorrector(apiKey, model) : new AnthropicBoundedCorrector(apiKey);
}

export function correctionParamsFromEnv(): CorrectionParams {
  const clamp = process.env['CORRECTION_CLAMP_MAX_PCT'];
  const requireZi = process.env['CORRECTION_REQUIRE_ZONE_INTEL'];
  return {
    enabled: process.env['CORRECTION_ENABLED'] === 'true',
    clampMaxPct: clamp ? Number(clamp) : DEFAULT_CORRECTION_PARAMS.clampMaxPct,
    requireZoneIntel: requireZi ? requireZi !== 'false' : DEFAULT_CORRECTION_PARAMS.requireZoneIntel,
  };
}
