import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { DOCUMENTI_BUCKET } from '@/lib/documents/supabase-store';
import { isDocumentKind, validateUpload } from '@/lib/documents/validate';

/**
 * POST /api/documenti/upload — multipart. Carica un documento (planimetria/APE/
 * nota vocale) nello Storage privato e crea la riga valuation_documents
 * (status='uploaded'). Aperta come /api/valutazione (il funnel venditore è
 * anonimo): la scrittura è service-role. Guardie: esistenza reference_id,
 * allowlist MIME + cap di dimensione. Nessun lavoro lento qui (l'estrazione è
 * on-demand via /api/documenti/process).
 */
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart non valido' }, { status: 400 });
  }

  const referenceId = form.get('reference_id');
  const kindRaw = form.get('kind');
  const file = form.get('file');
  const uploadedBy = form.get('uploaded_by') === 'seller' ? 'seller' : 'agent';

  if (typeof referenceId !== 'string' || referenceId === '') {
    return NextResponse.json({ error: 'reference_id mancante' }, { status: 400 });
  }
  const kind = typeof kindRaw === 'string' ? kindRaw : '';
  if (!isDocumentKind(kind)) {
    return NextResponse.json({ error: 'kind non valido' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file mancante' }, { status: 400 });
  }

  const valid = validateUpload(kind, file.type, file.size);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: reqRow, error: reqErr } = await service
    .from('valuation_requests')
    .select('reference_id')
    .eq('reference_id', referenceId)
    .single();
  if (reqErr || !reqRow) {
    return NextResponse.json({ error: 'valutazione non trovata' }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const path = `${referenceId}/${kind}/${id}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const up = await service.storage.from(DOCUMENTI_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) {
    console.error('[documenti/upload] storage', up.error.message);
    return NextResponse.json({ error: 'upload fallito' }, { status: 500 });
  }

  const { error: insErr } = await service.from('valuation_documents').insert({
    id,
    reference_id: referenceId,
    kind,
    storage_path: path,
    mime: file.type,
    byte_size: file.size,
    uploaded_by: uploadedBy,
    status: 'uploaded',
  });
  if (insErr) {
    console.error('[documenti/upload] insert', insErr.message);
    return NextResponse.json({ error: 'salvataggio fallito' }, { status: 500 });
  }

  return NextResponse.json({ id, status: 'uploaded' }, { status: 200 });
}
