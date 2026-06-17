/**
 * Flywheel (V2 Step 2): ogni volta che l'agente chiude una valutazione col
 * valore reale, registriamo lo scarto tra stima AI e valore di chiusura. È un
 * dato di SISTEMA (scritto col service role) che alimenterà la ricalibrazione
 * futura del motore. Logica PURA; l'insert è nella route finalize.
 */

export interface OverrideInput {
  referenceId: string;
  zonaOmiId: string | null;
  aiEstimateMin: number | null;
  aiEstimateMax: number | null;
  agentFinalValue: number;
  agentNotes?: string | null;
  coefficientSetId: string | null;
  modelVersion: number;
}

export interface OverrideRecord {
  reference_id: string;
  zona_omi_id: string | null;
  ai_estimate_min: number | null;
  ai_estimate_max: number | null;
  ai_point: number | null;
  agent_final_value: number;
  delta_pct: number | null;
  agent_notes: string | null;
  coefficient_set_id: string | null;
  model_version: number;
}

/** Punto AI = centro del range stimato (null se la stima non c'è). */
function aiPoint(min: number | null, max: number | null): number | null {
  if (min == null || max == null) return null;
  return (min + max) / 2;
}

export function buildOverrideRecord(input: OverrideInput): OverrideRecord {
  const ai_point = aiPoint(input.aiEstimateMin, input.aiEstimateMax);
  const delta_pct =
    ai_point != null && ai_point !== 0
      ? Math.round(((input.agentFinalValue - ai_point) / ai_point) * 1e6) / 1e6
      : null;

  return {
    reference_id: input.referenceId,
    zona_omi_id: input.zonaOmiId,
    ai_estimate_min: input.aiEstimateMin,
    ai_estimate_max: input.aiEstimateMax,
    ai_point,
    agent_final_value: input.agentFinalValue,
    delta_pct,
    agent_notes: input.agentNotes ?? null,
    coefficient_set_id: input.coefficientSetId,
    model_version: input.modelVersion,
  };
}
