import { clamp, round2 } from '../util';
import type { RawCorrection } from '../ports';
import type { AppliedCorrection, CorrectionParams, Estimate, ZoneIntelligence } from '../types';

/**
 * IL VINCOLO della correzione LLM (Fase 4), PURO. Il modello propone solo un
 * `factor_raw`; QUI lo si clampa entro ±clampMaxPct e si applica al valore
 * DETERMINISTICO (point/min/max scalati dello stesso fattore: la half-width
 * relativa resta invariata). Il numero finale = deterministico × clamp(factor),
 * MAI prodotto dall'LLM ⇒ riproducibile-spiegabile. Senza zone intelligence
 * (se richiesta) ⇒ fattore 1 (nessuna correzione).
 */

export interface BoundedCorrectionResult {
  estimate: Estimate;
  applied: AppliedCorrection;
}

export function applyBoundedCorrection(
  estimate: Estimate,
  raw: RawCorrection,
  params: CorrectionParams,
  zoneIntel: ZoneIntelligence | null,
  model: string,
  appliedAt: string,
): BoundedCorrectionResult {
  if (params.requireZoneIntel && zoneIntel == null) {
    return {
      estimate,
      applied: {
        factor_raw: raw.factor_raw,
        factor_applied: 1,
        clamped: false,
        motivazione: 'zone intelligence non disponibile: nessuna correzione',
        basis: 'none',
        model,
        applied_at: appliedAt,
      },
    };
  }

  const factor = clamp(raw.factor_raw, 1 - params.clampMaxPct, 1 + params.clampMaxPct);
  const clamped = factor !== raw.factor_raw;
  return {
    estimate: {
      min: round2(estimate.min * factor),
      max: round2(estimate.max * factor),
      pointEstimate: round2(estimate.pointEstimate * factor),
    },
    applied: {
      factor_raw: raw.factor_raw,
      factor_applied: round2(factor),
      clamped,
      motivazione: raw.motivazione,
      basis: 'zone_intelligence',
      model,
      applied_at: appliedAt,
    },
  };
}
