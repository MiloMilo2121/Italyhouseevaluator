import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/lib/db/client';
import { createPeriziaWriter } from '@/lib/perizia/factory';
import { DEFAULT_PERIZIA_MODEL } from '@/lib/perizia/anthropic';
import { buildPeriziaInput } from '@/lib/perizia/prompt';
import { createSupabaseDocumentStore } from '@/lib/documents/supabase-store';
import { flattenDetailRow, rowToEnrichResult, type DetailDbRow } from '@/lib/agenti/card';
import { getServerEnv } from '@/lib/env';
import type { DocumentAttachment } from '@/lib/perizia/types';

/**
 * Genera (on-demand) la PERIZIA long-context. Authed (re-check getClaims, 401).
 * "Carica tutto una volta": dossier completo (enrich + catasto + document_facts +
 * narrazione + trascrizioni) + documenti sorgente (planimetria/APE) ri-scaricati
 * dallo Storage e allegati. Persiste `perizia` col SERVICE client (trigger 0020).
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_ATTACHMENTS = 5;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  // Documenti: trascrizioni vocali (per il dossier) + allegati planimetria/APE.
  const { data: docsData } = await supabase
    .from('valuation_documents')
    .select('kind, status, transcript, storage_path, mime')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: true });
  const docs = (docsData ?? []) as {
    kind: string;
    status: string;
    transcript: string | null;
    storage_path: string;
    mime: string | null;
  }[];

  const transcripts = docs
    .filter((d) => d.kind === 'nota_vocale' && d.transcript)
    .map((d) => d.transcript as string);

  const service = createServiceClient();
  const store = createSupabaseDocumentStore(service);
  const attachments: DocumentAttachment[] = [];
  for (const d of docs) {
    if (attachments.length >= MAX_ATTACHMENTS) break;
    if (d.kind !== 'planimetria' && d.kind !== 'ape') continue;
    if (d.status !== 'uploaded' && d.status !== 'extracted') continue;
    try {
      attachments.push(await store.download(d.storage_path));
    } catch (e) {
      console.error('[perizia] download allegato fallito', e);
    }
  }

  const input = buildPeriziaInput(
    enrich,
    {
      referenceId: row.reference_id,
      indirizzo: row.address_normalized ?? row.address_raw,
      comune: row.comune,
      propertyType: row.property_type,
      superficieDichiarataMq: num(row.superficie_mq),
    },
    {
      catasto: row.catasto,
      documentFacts: row.document_facts,
      narrative: row.narrative,
      transcripts,
    },
  );

  let sections;
  try {
    sections = await createPeriziaWriter().write(input, attachments);
  } catch (e) {
    console.error('[perizia] errore LLM', e);
    return NextResponse.json({ error: 'Generazione perizia fallita' }, { status: 502 });
  }

  if (sections == null) {
    return NextResponse.json({ perizia: null, note: 'Perizia non disponibile (LLM non configurato).' });
  }

  const perizia = {
    sections,
    generatedAt: new Date().toISOString(),
    model: getServerEnv().PERIZIA_MODEL ?? DEFAULT_PERIZIA_MODEL,
  };
  const { error: upErr } = await service
    .from('valuation_requests')
    .update({ perizia })
    .eq('reference_id', referenceId);
  if (upErr) {
    console.error('[perizia] persist fallito', upErr.message);
    return NextResponse.json({ perizia, note: 'Perizia generata ma non salvata.' });
  }

  return NextResponse.json({ perizia });
}
