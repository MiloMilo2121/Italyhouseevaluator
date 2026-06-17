import { describe, it, expect } from 'vitest';
import { FinalizeSchema, buildFinalizeUpdate, finalizeValuation } from '@/lib/agenti/finalize';
import type { AgentFinalizePort } from '@/lib/agenti/ports';

describe('finalize — chiusura flywheel (§11)', () => {
  it('FinalizeSchema rifiuta valore non positivo / NaN / mancante', () => {
    expect(FinalizeSchema.safeParse({ agent_final_value: 0 }).success).toBe(false);
    expect(FinalizeSchema.safeParse({ agent_final_value: -5 }).success).toBe(false);
    expect(FinalizeSchema.safeParse({ agent_final_value: Number.NaN }).success).toBe(false);
    expect(FinalizeSchema.safeParse({}).success).toBe(false);
    expect(FinalizeSchema.safeParse({ agent_final_value: 250000 }).success).toBe(true);
  });

  it('buildFinalizeUpdate setta completed + completed_at ISO; omette note vuote', () => {
    const u = buildFinalizeUpdate({ agent_final_value: 250000 });
    expect(u['valuation_status']).toBe('completed');
    expect(typeof u['completed_at']).toBe('string');
    expect('agent_notes' in u).toBe(false);
    expect(buildFinalizeUpdate({ agent_final_value: 250000, agent_notes: 'ok' })['agent_notes']).toBe('ok');
  });

  it('finalizeValuation valida e chiama il port una volta; input invalido ⇒ ok:false', async () => {
    const calls: { refId: string; update: Record<string, unknown> }[] = [];
    const port: AgentFinalizePort = {
      finalize: async (refId, update) => {
        calls.push({ refId, update });
      },
    };

    const good = await finalizeValuation('VAL-1', { reference_id: 'VAL-1', agent_final_value: 250000 }, port);
    expect(good.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.update['valuation_status']).toBe('completed');

    const bad = await finalizeValuation('VAL-1', { agent_final_value: -1 }, port);
    expect(bad.ok).toBe(false);
    expect(calls).toHaveLength(1); // port NON richiamato su input invalido
  });
});
