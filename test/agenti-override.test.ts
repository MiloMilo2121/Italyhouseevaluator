import { describe, it, expect } from 'vitest';
import { buildOverrideRecord, type OverrideInput } from '@/lib/agenti/override';

const base: OverrideInput = {
  referenceId: 'VAL-ABC',
  zonaOmiId: 'MI_1',
  aiEstimateMin: 180000,
  aiEstimateMax: 220000,
  agentFinalValue: 220000,
  agentNotes: 'venduto sopra stima',
  coefficientSetId: 'cs-1',
  modelVersion: 2,
};

describe('buildOverrideRecord — flywheel', () => {
  it('calcola ai_point (centro range) e delta_pct vs valore reale', () => {
    const r = buildOverrideRecord(base);
    expect(r.ai_point).toBe(200000); // (180000 + 220000) / 2
    expect(r.delta_pct).toBe(0.1); // (220000 − 200000) / 200000
    expect(r.reference_id).toBe('VAL-ABC');
    expect(r.zona_omi_id).toBe('MI_1');
    expect(r.coefficient_set_id).toBe('cs-1');
    expect(r.model_version).toBe(2);
    expect(r.agent_notes).toBe('venduto sopra stima');
  });

  it('delta_pct negativo quando il reale è sotto la stima', () => {
    const r = buildOverrideRecord({ ...base, agentFinalValue: 180000 });
    expect(r.delta_pct).toBe(-0.1); // (180000 − 200000) / 200000
  });

  it('delta_pct e ai_point null quando manca la stima AI', () => {
    const r = buildOverrideRecord({ ...base, aiEstimateMin: null, aiEstimateMax: null });
    expect(r.ai_point).toBeNull();
    expect(r.delta_pct).toBeNull();
    expect(r.agent_final_value).toBe(220000); // il valore reale resta tracciato
  });

  it('agent_notes assente ⇒ null (non stringa vuota)', () => {
    const input = { ...base };
    delete (input as Partial<OverrideInput>).agentNotes;
    const r = buildOverrideRecord(input);
    expect(r.agent_notes).toBeNull();
  });
});
