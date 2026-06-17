import { z } from 'zod';
import type { AgentFinalizePort } from './ports';

/**
 * Chiusura del flywheel (§11): l'agente inserisce il valore finale reale. Logica
 * PURA testabile; il side-effect (DB) è dietro AgentFinalizePort. Setta
 * valuation_status='completed' + completed_at.
 */

export const FinalizeSchema = z.object({
  agent_final_value: z.number().positive(),
  agent_notes: z.string().min(1).optional(),
});

export type FinalizeInput = z.infer<typeof FinalizeSchema>;

export function buildFinalizeUpdate(i: FinalizeInput): Record<string, unknown> {
  return {
    agent_final_value: i.agent_final_value,
    ...(i.agent_notes ? { agent_notes: i.agent_notes } : {}),
    valuation_status: 'completed',
    completed_at: new Date().toISOString(),
  };
}

export type FinalizeResult = { ok: true } | { ok: false; errors: z.ZodIssue[] };

export async function finalizeValuation(
  referenceId: string,
  rawInput: unknown,
  port: AgentFinalizePort,
): Promise<FinalizeResult> {
  const parsed = FinalizeSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues };
  await port.finalize(referenceId, buildFinalizeUpdate(parsed.data));
  return { ok: true };
}
