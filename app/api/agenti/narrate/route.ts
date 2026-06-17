import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/lib/db/client';
import { createNarrator } from '@/lib/narration/factory';
import { buildNarrationInput } from '@/lib/narration/prompt';
import { flattenDetailRow, rowToEnrichResult, type DetailDbRow } from '@/lib/agenti/card';

/**
 * Genera (on-demand) la relazione narrata di una valutazione. Autenticato:
 * re-check getClaims (401). Carica la riga col client authed (RLS lo consente),
 * costruisce il grounding (solo numeri, niente PII del lead), chiama il
 * Narrator (Claude o NullNarrator) e PERSISTE `narrative` col SERVICE client —
 * obbligatorio perché il trigger 0015 protegge la colonna dagli agenti.
 * On-demand ⇒ fuori dal hot-path sincrono di /api/valutazione.
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

  const { data, error } = await supabase
    .from('valuation_requests')
    .select('*')
    .eq('reference_id', referenceId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Valutazione non trovata' }, { status: 404 });
  }

  const row = flattenDetailRow(data as unknown as DetailDbRow);
  const enrich = rowToEnrichResult(row);
  if (enrich == null) {
    return NextResponse.json({ error: 'Valutazione non ancora arricchita' }, { status: 409 });
  }

  const input = buildNarrationInput(enrich, {
    referenceId: row.reference_id,
    indirizzo: row.address_normalized ?? row.address_raw,
    comune: row.comune,
  });

  let narrative;
  try {
    narrative = await createNarrator().narrate(input);
  } catch (e) {
    console.error('[narrate] errore LLM', e);
    return NextResponse.json({ error: 'Generazione narrazione fallita' }, { status: 502 });
  }

  if (narrative == null) {
    // NullNarrator (LLM non configurato) o parsing fallito: degrado pulito.
    return NextResponse.json({ narrative: null, note: 'Narrazione non disponibile (LLM non configurato).' });
  }

  const service = createServiceClient();
  const { error: upErr } = await service
    .from('valuation_requests')
    .update({ narrative })
    .eq('reference_id', referenceId);
  if (upErr) {
    console.error('[narrate] persist fallito', upErr.message);
    // La narrazione è valida anche se non persistita: la ritorniamo comunque.
    return NextResponse.json({ narrative, note: 'Narrazione generata ma non salvata.' });
  }

  return NextResponse.json({ narrative });
}
