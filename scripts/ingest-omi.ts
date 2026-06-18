/**
 * Ingestion OMI (M3). Legge i file OMI reali da path locali, esegue la pipeline
 * PURA (lib/omi/ingest) e fa l'upsert idempotente su Supabase via RPC
 * omi_upsert_quotations (che costruisce la geometria con ST_MakeValid).
 *
 * I file OMI sono gated da SPID/area riservata: metterli in data/omi/ (vedi
 * README). Encoding forzato UTF-8.
 *
 *   npm run ingest:omi -- --semestre 2024-2 \
 *     --valori data/omi/valori.csv --zone data/omi/zone.csv --kml data/omi/zone.kml
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildGeometryMap, ingestOmi } from '@/lib/omi/ingest';
import type { GeoJsonMultiPolygon, IngestionReport, OmiUpsertRow } from '@/lib/omi/types';
import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { createServiceClient } from '@/lib/db/client';

interface Args {
  semestre: string;
  valori: string;
  zone: string;
  kml: string;
  kmlDir: string;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  return {
    semestre: get('--semestre', process.env['OMI_SEMESTRE'] ?? ''),
    valori: get('--valori', 'data/omi/valori.csv'),
    zone: get('--zone', 'data/omi/zone.csv'),
    kml: get('--kml', 'data/omi/zone.kml'),
    kmlDir: get('--kml-dir', ''),
    dryRun: argv.includes('--dry-run'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

/**
 * Costruisce il map geometrico da una directory di KML (formato reale: un file
 * per comune, es. A001.kml). Itera file per file fondendo i map, così da NON
 * concatenare centinaia di MB in un'unica stringa (il regex backtrackerebbe).
 */
function buildGeometryMapFromDir(dir: string): Map<string, GeoJsonMultiPolygon> {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.kml'));
  const map = new Map<string, GeoJsonMultiPolygon>();
  let done = 0;
  for (const file of files) {
    const kml = readFileSync(join(dir, file), 'utf-8');
    const { map: fileMap } = buildGeometryMap(kml);
    for (const [k, v] of fileMap) map.set(k, v);
    if (++done % 500 === 0) console.log(`  KML ${done}/${files.length} (${map.size} zone)`);
  }
  console.log(`  KML ${files.length}/${files.length} → ${map.size} zone con geometria valida`);
  return map;
}

const HELP = `Ingestion OMI → Supabase/PostGIS

Uso:
  npm run ingest:omi -- --semestre <YYYY-S> [opzioni]

Opzioni:
  --semestre <YYYY-S>  Semestre dei dati (obbligatorio), es. 2024-2
  --valori <path>      File VALORI csv      (default data/omi/valori.csv)
  --zone <path>        File ZONE csv        (default data/omi/zone.csv)
  --kml <path>         Perimetri KML singolo (default data/omi/zone.kml)
  --kml-dir <path>     Directory di KML (un file per comune, es. A001.kml).
                       Se presente, ha precedenza su --kml.
  --dry-run            Esegue la pipeline e stampa il report, senza scrivere su DB
  --help, -h           Mostra questo aiuto
`;

function printReport(report: IngestionReport): void {
  console.log(`\n── Report ingestion OMI (semestre ${report.semestre}) ──`);
  console.log(`  quotazioni parsate : ${report.quotationsParsed}`);
  console.log(`  zone parsate       : ${report.zonesParsed}`);
  console.log(`  geometrie valide   : ${report.geometriesParsed}`);
  console.log(`  righe upsert       : ${report.upsertRows}`);
  console.log(`  con geometria      : ${report.rowsWithGeometry}`);
  console.log(`  senza geometria    : ${report.rowsWithoutGeometry}`);
  const byKind = new Map<string, number>();
  for (const f of report.flags) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  if (byKind.size > 0) {
    console.log('  segnalazioni:');
    for (const [kind, count] of byKind) console.log(`    - ${kind}: ${count}`);
  }
}

async function upsertInBatches(rows: OmiUpsertRow[], batchSize = 500): Promise<number> {
  const client = createServiceClient() as unknown as SupabaseRpcClient;
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await client.rpc('omi_upsert_quotations', { p_rows: batch });
    if (error) throw new Error(`Upsert batch ${i / batchSize} fallito: ${error.message}`);
    total += typeof data === 'number' ? data : batch.length;
    console.log(`  upsert ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
  return total;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.semestre) {
    console.error('Errore: --semestre è obbligatorio (es. --semestre 2024-2).\n');
    console.log(HELP);
    process.exitCode = 1;
    return;
  }

  const kmlSource = args.kmlDir ? `dir:${args.kmlDir}` : args.kml;
  console.log(`Lettura file OMI (UTF-8): ${args.valori}, ${args.zone}, ${kmlSource}`);
  const valoriCsv = readFileSync(args.valori, 'utf-8');
  const zoneCsv = readFileSync(args.zone, 'utf-8');

  const ingestInput = args.kmlDir
    ? { valoriCsv, zoneCsv, geometryMap: buildGeometryMapFromDir(args.kmlDir), semestre: args.semestre }
    : { valoriCsv, zoneCsv, kml: readFileSync(args.kml, 'utf-8'), semestre: args.semestre };

  const { rows, report } = ingestOmi(ingestInput);
  printReport(report);

  if (args.dryRun) {
    console.log('\n[dry-run] nessuna scrittura su DB.');
    return;
  }

  console.log('\nUpsert su Supabase…');
  const upserted = await upsertInBatches(rows);
  console.log(`\n✓ Ingestion completata: ${upserted} righe upsertate (semestre ${report.semestre}).`);
}

main().catch((err: unknown) => {
  console.error('\n✗ Ingestion fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
