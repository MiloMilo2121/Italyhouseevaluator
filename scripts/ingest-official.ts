/**
 * Ingestion comparabili da FONTI UFFICIALI (V2 Step 5): idealista/data,
 * Immobiliare.it Insights, … (registry estensibile). Sostituisce la SORGENTE
 * dello scraping Apify; retrieval (`comps_near`) e motore restano invariati.
 * Pipeline: adapter.fetchListings/extract → normalizeListings → comps_upsert.
 *
 *   # dry-run su un export locale (nessuna chiave/rete, nessuna scrittura):
 *   npm run ingest:official -- --source idealista_data --file data/comps/idealista.json --dry-run
 *   # live (richiede la chiave della fonte + Supabase):
 *   npm run ingest:official -- --source immobiliare_insights --lat 45.46 --lng 9.19 --radius 1500
 */
import { readFileSync } from 'node:fs';
import { getServerEnv } from '@/lib/env';
import { createCompsSourceAdapter, getCompsExtractor } from '@/lib/comps/sources/registry';
import { normalizeListings, type RawListing } from '@/lib/comps/normalize';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { createServiceClient } from '@/lib/db/client';

interface Args {
  source: string;
  file: string | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  const n = (flag: string): number | null => {
    const v = get(flag);
    if (v == null) return null;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  };
  return {
    source: get('--source') ?? 'idealista_data',
    file: get('--file'),
    lat: n('--lat'),
    lng: n('--lng'),
    radius: n('--radius'),
    dryRun: argv.includes('--dry-run'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

const HELP = `Ingestion comparabili da fonti ufficiali (idealista/data, Immobiliare.it Insights)

Uso:
  npm run ingest:official -- --source <idealista_data|immobiliare_insights> [--file <path> | --lat <n> --lng <n> [--radius <m>]] [--dry-run]

Opzioni:
  --source     fonte (default idealista_data)
  --file       export JSON locale (array di item grezzi della fonte) — non richiede chiave/rete
  --lat/--lng  centro per il fetch live (richiede la chiave della fonte)
  --radius     raggio in metri (default 1500)
  --dry-run    pipeline + report, senza scrivere su DB
  --help, -h   questo aiuto
`;

async function loadRaw(args: Args): Promise<RawListing[]> {
  if (args.file) {
    const extractor = getCompsExtractor(args.source);
    if (!extractor) throw new Error(`Fonte sconosciuta: ${args.source}`);
    const items = JSON.parse(readFileSync(args.file, 'utf-8')) as unknown[];
    return items.map(extractor).filter((r): r is RawListing => r !== null);
  }
  const adapter = createCompsSourceAdapter(args.source, getServerEnv());
  if (!adapter) throw new Error(`Fonte "${args.source}" non configurata (chiave mancante?)`);
  if (args.lat == null || args.lng == null) throw new Error('Specificare --file oppure --lat e --lng.');
  const items = await adapter.fetchListings({
    lat: args.lat,
    lng: args.lng,
    radiusMeters: args.radius ?? 1500,
    limit: 50,
  });
  return items.map((it) => adapter.extract(it)).filter((r): r is RawListing => r !== null);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const raw = await loadRaw(args);
  const comps = normalizeListings(raw);

  console.log(`\n── Ingestion comparabili ufficiali (${args.source}) ──`);
  console.log(`  estratti     : ${raw.length}`);
  console.log(`  normalizzati : ${comps.length} (dopo dedup + outlier)`);

  if (args.dryRun) {
    console.log('\n[dry-run] nessuna scrittura su DB.');
    return;
  }

  const client = createServiceClient() as unknown as SupabaseRpcClient;
  const { data, error } = await client.rpc('comps_upsert', { p_rows: comps });
  if (error) throw new Error(`comps_upsert fallita: ${error.message}`);
  console.log(`\n✓ Upsert completato: ${typeof data === 'number' ? data : comps.length} comparabili.`);
}

main().catch((err: unknown) => {
  console.error('\n✗ Ingestion ufficiale fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
