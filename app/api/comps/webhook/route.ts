import { NextResponse } from 'next/server';
import { ApifyClient, extract } from '@/lib/comps/apify';
import { normalizeListings, type RawListing } from '@/lib/comps/normalize';
import { createServiceClient } from '@/lib/db/client';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';

/**
 * Webhook Apify (V2): ricevuto `ACTOR.RUN.SUCCEEDED`, recupera il dataset, lo
 * normalizza e fa upsert idempotente su `comps`. Risponde 200 (Apify ritenta
 * altrimenti). Gated: richiede APIFY_TOKEN + Supabase. `?portal=` indica il mapping.
 */
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const token = process.env['APIFY_TOKEN'];
  if (!token) return NextResponse.json({ error: 'APIFY_TOKEN non configurato' }, { status: 503 });

  const portal = new URL(req.url).searchParams.get('portal') === 'idealista' ? 'idealista' : 'immobiliare';

  let body: { resource?: { defaultDatasetId?: string } };
  try {
    body = (await req.json()) as { resource?: { defaultDatasetId?: string } };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  const datasetId = body.resource?.defaultDatasetId;
  if (!datasetId) return NextResponse.json({ error: 'defaultDatasetId mancante' }, { status: 400 });

  try {
    const items = await new ApifyClient({ token }).fetchDatasetItems(datasetId);
    const raw: RawListing[] = items
      .map((it) => extract(it, portal))
      .filter((r): r is RawListing => r !== null);
    const comps = normalizeListings(raw);

    const client = createServiceClient() as unknown as SupabaseRpcClient;
    const { error } = await client.rpc('comps_upsert', { p_rows: comps });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, upserted: comps.length });
  } catch (err) {
    console.error('[comps webhook] errore:', err);
    // 200 per evitare retry infiniti se il problema è dati, log per indagine.
    return NextResponse.json({ ok: false, error: 'ingestion fallita' }, { status: 200 });
  }
}
