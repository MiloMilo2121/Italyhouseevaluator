import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { DOCUMENTI_BUCKET } from '@/lib/documents/supabase-store';
import { isDocumentKind, validateUpload } from '@/lib/documents/validate';

/**
 * POST /api/documenti/upload — supporta due modalità:
 *  1. Handshake JSON (Direct-to-Storage): bypassa il limite di 4.5 MB di Vercel/Serverless.
 *     - action: 'prepare' -> genera signed upload URL e token.
 *     - action: 'confirm' -> verifica e registra il documento in valuation_documents.
 *  2. Multipart form-data fallback per file piccoli o client tradizionali.
 */
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const contentType = req.headers.get('content-type') ?? '';

  // Modalità 1: Handshake JSON Direct-to-Storage (Direct Upload via Signed URL)
  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
    }

    const action = body.action;
    const service = createServiceClient();

    if (action === 'prepare') {
      const referenceId = typeof body.reference_id === 'string' ? body.reference_id : '';
      const kind = typeof body.kind === 'string' ? body.kind : '';
      const mime = typeof body.mime === 'string' ? body.mime : '';
      const byteSize = typeof body.byte_size === 'number' ? body.byte_size : -1;

      if (!referenceId) {
        return NextResponse.json({ error: 'reference_id mancante' }, { status: 400 });
      }
      if (!isDocumentKind(kind)) {
        return NextResponse.json({ error: 'kind non valido' }, { status: 400 });
      }
      const valid = validateUpload(kind, mime, byteSize);
      if (!valid.ok) {
        return NextResponse.json({ error: valid.error }, { status: 400 });
      }

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

      const { data: signedData, error: sErr } = await service.storage
        .from(DOCUMENTI_BUCKET)
        .createSignedUploadUrl(path);

      if (sErr || !signedData) {
        console.error('[documenti/upload] createSignedUploadUrl', sErr?.message);
        return NextResponse.json({ error: 'impossibile generare upload URL' }, { status: 500 });
      }

      return NextResponse.json({
        id,
        path,
        signedUrl: signedData.signedUrl,
        token: signedData.token,
      });
    }

    if (action === 'confirm') {
      const id = typeof body.id === 'string' ? body.id : '';
      const referenceId = typeof body.reference_id === 'string' ? body.reference_id : '';
      const kind = typeof body.kind === 'string' ? body.kind : '';
      const path = typeof body.path === 'string' ? body.path : '';
      const mime = typeof body.mime === 'string' ? body.mime : '';
      const byteSize = typeof body.byte_size === 'number' ? body.byte_size : 0;
      const uploadedBy = body.uploaded_by === 'seller' ? 'seller' : 'agent';

      if (!id || !referenceId || !isDocumentKind(kind) || !path) {
        return NextResponse.json({ error: 'parametri mancanti o non validi' }, { status: 400 });
      }

      // Guard: impedisce path traversal o disallineamento reference/kind
      const expectedPrefix = `${referenceId}/${kind}/${id}`;
      if (path !== expectedPrefix) {
        return NextResponse.json({ error: 'percorso file non valido' }, { status: 400 });
      }

      const { data: reqRow, error: reqErr } = await service
        .from('valuation_requests')
        .select('reference_id')
        .eq('reference_id', referenceId)
        .single();
      if (reqErr || !reqRow) {
        return NextResponse.json({ error: 'valutazione non trovata' }, { status: 404 });
      }

      const { error: insErr } = await service.from('valuation_documents').insert({
        id,
        reference_id: referenceId,
        kind,
        storage_path: path,
        mime,
        byte_size: byteSize,
        uploaded_by: uploadedBy,
        status: 'uploaded',
      });
      if (insErr) {
        console.error('[documenti/upload] insert', insErr.message);
        return NextResponse.json({ error: 'salvataggio fallito' }, { status: 500 });
      }

      return NextResponse.json({ id, status: 'uploaded' }, { status: 200 });
    }

    return NextResponse.json({ error: 'azione non supportata' }, { status: 400 });
  }

  // Modalità 2: Multipart form-data fallback
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
