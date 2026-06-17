import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/lib/db/client';
import { finalizeValuation } from '@/lib/agenti/finalize';
import { buildOverrideRecord } from '@/lib/agenti/override';

/**
 * Chiusura del flywheel (§11). Autenticato: re-check getClaims (401 se assente),
 * valida via FinalizeSchema, scrive via il client authed (RLS + trigger 0012
 * impongono che si tocchino solo i campi agente). Dopo la chiusura registra lo
 * scarto stima AI↔valore reale in `valuation_overrides` (dato di sistema, scritto
 * col service role) — best-effort: un fallimento non fa fallire la chiusura.
 */
export const runtime = 'nodejs';

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface OverrideRow {
  estimate_min: number | string | null;
  estimate_max: number | string | null;
  zona_omi_id: string | null;
  coefficient_set_id: string | null;
  model_version: number | null;
  agent_final_value: number | string | null;
  agent_notes: string | null;
}

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Registra lo scarto AI↔reale. Best-effort: log su errore, mai throw. */
async function recordOverride(reader: ServerSupabase, referenceId: string): Promise<void> {
  try {
    const { data, error } = await reader
      .from('valuation_requests')
      .select('estimate_min, estimate_max, zona_omi_id, coefficient_set_id, model_version, agent_final_value, agent_notes')
      .eq('reference_id', referenceId)
      .single();
    if (error || !data) return;
    const row = data as OverrideRow;
    const agentFinalValue = num(row.agent_final_value);
    if (agentFinalValue == null) return;

    const record = buildOverrideRecord({
      referenceId,
      zonaOmiId: row.zona_omi_id,
      aiEstimateMin: num(row.estimate_min),
      aiEstimateMax: num(row.estimate_max),
      agentFinalValue,
      agentNotes: row.agent_notes,
      coefficientSetId: row.coefficient_set_id,
      modelVersion: row.model_version ?? 1,
    });

    const { error: insErr } = await createServiceClient().from('valuation_overrides').insert(record);
    if (insErr) console.error('[finalize] override insert fallito', insErr.message);
  } catch (e) {
    console.error('[finalize] override best-effort fallito', e);
  }
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims == null) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  let body: { reference_id?: unknown };
  try {
    body = (await req.json()) as { reference_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const referenceId = body.reference_id;
  if (typeof referenceId !== 'string') {
    return NextResponse.json({ error: 'reference_id mancante' }, { status: 400 });
  }

  const result = await finalizeValuation(referenceId, body, {
    finalize: async (refId, update) => {
      const { error } = await supabase.from('valuation_requests').update(update).eq('reference_id', refId);
      if (error) throw new Error(error.message);
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'Validazione fallita', issues: result.errors }, { status: 400 });
  }

  // Flywheel: registra lo scarto stima AI↔valore reale (best-effort).
  await recordOverride(supabase, referenceId);

  return NextResponse.json({ ok: true });
}
