/**
 * Ingestion comparabili (V2). Sorgente: dataset Apify (annunci Immobiliare.it /
 * Idealista) — comprati pay-per-result, usati come INPUT AGGREGATO INTERNO (mai
 * mirror ripubblicato: niente foto/descrizioni). Pipeline pura (extract →
 * normalizeListings) poi upsert idempotente su `comps` (cache per zona).
 *
 *   # dry-run su un export locale del dataset (nessuna scrittura):
 *   npm run ingest:comps -- --portal immobiliare --file data/comps/dataset.json --dry-run
 *   # live: recupera un dataset Apify e fa upsert (richiede APIFY_TOKEN + Supabase):
 *   npm run ingest:comps -- --portal idealista --dataset <datasetId>
 */
import { readFileSync } from 'node:fs';
import { ApifyClient, extract } from '@/lib/comps/apify';
import { normalizeListings, type RawListing } from '@/lib/comps/normalize';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { createServiceClient } from '@/lib/db/client';

interface Args {
  portal: 'immobiliare' | 'idealista';
  file: string | null;
  dataset: string | null;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  const portal = get('--portal') === 'idealista' ? 'idealista' : 'immobiliare';
  return {
    portal,
    file: get('--file'),
    dataset: get('--dataset'),
    dryRun: argv.includes('--dry-run'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

const HELP = `Ingestion comparabili (Apify → comps)

Uso:
  npm run ingest:comps -- --portal <immobiliare|idealista> [--file <path> | --dataset <id>] [--dry-run]

Opzioni:
  --portal     immobiliare | idealista (default immobiliare)
  --file       export JSON locale del dataset Apify (array di item)
  --dataset    id dataset Apify da recuperare (richiede APIFY_TOKEN)
  --dry-run    pipeline + report, senza scrivere su DB
  --help, -h   questo aiuto
`;

async function loadItems(args: Args): Promise<Record<string, unknown>[]> {
  if (args.file) {
    return JSON.parse(readFileSync(args.file, 'utf-8')) as Record<string, unknown>[];
  }
  if (args.dataset) {
    const token = process.env['APIFY_TOKEN'];
    if (!token) throw new Error('APIFY_TOKEN mancante per --dataset');
    return new ApifyClient({ token }).fetchDatasetItems(args.dataset);
  }
  throw new Error('Specificare --file <path> oppure --dataset <id>.');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const items = await loadItems(args);
  const raw: RawListing[] = items
    .map((it) => extract(it, args.portal))
    .filter((r): r is RawListing => r !== null);
  const comps = normalizeListings(raw);

  console.log(`\n── Ingestion comparabili (${args.portal}) ──`);
  console.log(`  item grezzi      : ${items.length}`);
  console.log(`  estratti         : ${raw.length}`);
  console.log(`  normalizzati     : ${comps.length} (dopo dedup + outlier)`);

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
  console.error('\n✗ Ingestion comparabili fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
