import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/lib/db/client';
import { DOCUMENTI_BUCKET } from '@/lib/documents/supabase-store';

/**
 * GET /api/documenti/signed-url?id=... — authed. Genera un URL firmato a breve
 * scadenza per l'anteprima di un documento (bucket privato, letture via signed
 * URL: nessuna policy SELECT su storage.objects). Solo agenti autenticati.
 */
export const runtime = 'nodejs';

const TTL_SECONDS = 300;

export async function GET(req: Request): Promise<Response> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims == null) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id mancante' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: doc, error } = await service
    .from('valuation_documents')
    .select('storage_path')
    .eq('id', id)
    .single();
  if (error || !doc) {
    return NextResponse.json({ error: 'documento non trovato' }, { status: 404 });
  }

  const storagePath = (doc as { storage_path: string }).storage_path;
  const { data, error: sErr } = await service.storage
    .from(DOCUMENTI_BUCKET)
    .createSignedUrl(storagePath, TTL_SECONDS);
  if (sErr || !data) {
    return NextResponse.json({ error: 'URL firmato non disponibile' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
