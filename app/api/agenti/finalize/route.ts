import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { finalizeValuation } from '@/lib/agenti/finalize';

/**
 * Chiusura del flywheel (§11). Autenticato: re-check getClaims (401 se assente),
 * valida via FinalizeSchema, scrive via il client authed (RLS + trigger 0012
 * impongono che si tocchino solo i campi agente).
 */
export const runtime = 'nodejs';

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
  return NextResponse.json({ ok: true });
}
