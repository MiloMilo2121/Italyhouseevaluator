import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';

/**
 * Integrazione DB reale dell'RPC transazionale create_valuation_request: dedup
 * idempotente su input_hash + niente lead duplicati su re-submit. GUARDATO:
 * gira solo con OMI_TEST_SUPABASE_URL + OMI_TEST_SUPABASE_SERVICE_KEY e le
 * migrazioni applicate (incl. 0011). Escluso dal run di default.
 */

const url = process.env['OMI_TEST_SUPABASE_URL'];
const key = process.env['OMI_TEST_SUPABASE_SERVICE_KEY'];
const enabled = Boolean(url && key);

interface RpcResult {
  reference_id: string;
  created: boolean;
}

describe.skipIf(!enabled)('integrazione create_valuation_request (DB reale)', () => {
  let client: ReturnType<typeof createClient>;
  let rpc: SupabaseRpcClient;

  const stamp = Date.now();
  const hash = `itest-hash-${stamp}`;
  const email = `itest+${stamp}@example.it`;
  const lead = {
    nome: 'Test',
    cognome: 'Integrazione',
    email,
    telefono: '3330000000',
    consent_privacy: true,
    consent_marketing: false,
    intent: 'vendere_ora',
    is_priority: true,
  };
  const request = {
    reference_id: `VAL-${stamp.toString(16).slice(-8).toUpperCase().padStart(8, '0')}`,
    input_hash: hash,
    coefficient_set_id: null,
    model_version: 1,
    property_type: 'appartamento',
    superficie_mq: 85,
    stanze: 3,
    ascensore: true,
    has_balcone: false,
    has_garage: false,
    has_giardino: false,
    condizioni: 'ristrutturata',
    anni_ristrutturazione: '<5',
    piano: 3,
    piano_label: null,
    piani_edificio: 6,
    riscaldamento: null,
    classe_energetica: 'A',
    address_raw: 'Via Test 1',
    address_normalized: null,
    comune: 'Milano',
    cap: '20100',
    lat: 45.467,
    lng: 9.19,
  };

  beforeAll(() => {
    client = createClient(url!, key!, { auth: { persistSession: false } });
    rpc = client as unknown as SupabaseRpcClient;
  });

  afterAll(async () => {
    await client.from('valuation_requests').delete().eq('input_hash', hash);
    await client.from('leads').delete().eq('email', email);
  });

  it('primo submit created=true; re-submit stesso input_hash created=false stesso ref; lead non duplicato', async () => {
    const first = await rpc.rpc('create_valuation_request', { p_lead: lead, p_request: request });
    const firstRes = first.data as RpcResult;
    expect(firstRes.created).toBe(true);

    const second = await rpc.rpc('create_valuation_request', { p_lead: lead, p_request: request });
    const secondRes = second.data as RpcResult;
    expect(secondRes.created).toBe(false);
    expect(secondRes.reference_id).toBe(firstRes.reference_id);

    const { count } = await client
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('email', email);
    expect(count).toBe(1);
  });
});
