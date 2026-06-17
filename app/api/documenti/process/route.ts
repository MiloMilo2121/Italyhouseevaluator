import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/lib/db/client';
import { buildProcessDeps } from '@/lib/documents/build-process-deps';
import { extractPending, reconcileReference, revertReference } from '@/lib/documents/process';

/**
 * POST /api/documenti/process — agent-triggered (authed). Elabora i documenti di
 * una reference fuori dal hot-path di /api/valutazione. `mode`:
 *  - 'extract'   : estrae i documenti 'uploaded' (vision/whisper), per-documento
 *                  e partial-safe (status sul record = macchina a stati).
 *  - 'reconcile' : SOLO se tutti i doc sono terminali → reconciler LLM + guardrail
 *                  puro + (se override applicati) re-enrich; persiste catasto +
 *                  document_facts via service role (trigger 0019 protegge le colonne).
 *  - 'revert'    : ricalcola dal dichiarato originale e azzera i fatti documentali.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

type Mode = 'extract' | 'reconcile' | 'revert';
const MODES: Mode[] = ['extract', 'reconcile', 'revert'];

export async function POST(req: Request): Promise<Response> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims == null) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  let body: { reference_id?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as { reference_id?: unknown; mode?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  const referenceId = body.reference_id;
  if (typeof referenceId !== 'string') {
    return NextResponse.json({ error: 'reference_id mancante' }, { status: 400 });
  }
  const mode: Mode = MODES.includes(body.mode as Mode) ? (body.mode as Mode) : 'extract';

  try {
    const service = createServiceClient();
    const deps = await buildProcessDeps(service);

    if (mode === 'extract') {
      const summary = await extractPending(referenceId, deps);
      return NextResponse.json({ mode, ...summary });
    }
    if (mode === 'reconcile') {
      const summary = await reconcileReference(referenceId, deps);
      return NextResponse.json({ mode, ...summary });
    }
    const ok = await revertReference(referenceId, deps);
    return NextResponse.json({ mode, ok });
  } catch (err) {
    console.error('[documenti/process] errore', err);
    return NextResponse.json({ error: 'Elaborazione fallita' }, { status: 500 });
  }
}
