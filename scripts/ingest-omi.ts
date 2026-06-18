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

// I runner standalone (tsx) non passano per il dotenv di Next: carico .env.local
// esplicitamente, così `npm run ingest:omi` trova le env Supabase out-of-the-box.
try {
  (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile('.env.local');
} catch {
  // file assente o Node senza loadEnvFile: si usano le env già nell'ambiente.
}

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
  let unreadable = 0;
  let collisions = 0;
  for (const file of files) {
    let kml: string;
    try {
      kml = readFileSync(join(dir, file), 'utf-8');
    } catch (err) {
      // Un file illeggibile non deve abortire l'intera build di 7887 file.
      unreadable++;
      console.warn(`  ⚠ KML non leggibile, saltato: ${file} (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const { map: fileMap } = buildGeometryMap(kml);
    for (const [k, v] of fileMap) {
      if (map.has(k)) collisions++;
      map.set(k, v);
    }
    if (++done % 500 === 0) console.log(`  KML ${done}/${files.length} (${map.size} zone)`);
  }
  console.log(`  KML ${done}/${files.length} → ${map.size} zone con geometria valida`);
  if (unreadable > 0) console.warn(`  ⚠ ${unreadable} file KML non leggibili saltati`);
  if (collisions > 0) console.warn(`  ⚠ ${collisions} collisioni di chiave zona tra file (ultimo vince)`);
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

interface UpsertOutcome {
  total: number;
  droppedGeom: string[]; // link_zona reinseriti senza geometria (geom degenere)
  failed: string[]; // link_zona non inseribili nemmeno senza geometria
}

/** Inserisce una singola riga; se fallisce, ritenta senza geometria (geometria
 *  degenere che ST_MakeValid trasforma in GeometryCollection ⇒ rifiutata dalla
 *  colonna MultiPolygon). Preserva sempre la quotazione €/mq. */
async function upsertSingleRow(
  client: SupabaseRpcClient,
  row: OmiUpsertRow,
): Promise<'ok' | 'ok-nogeom' | 'fail'> {
  const first = await client.rpc('omi_upsert_quotations', { p_rows: [row] });
  if (!first.error) return 'ok';
  const retry = await client.rpc('omi_upsert_quotations', { p_rows: [{ ...row, geom_geojson: null }] });
  return retry.error ? 'fail' : 'ok-nogeom';
}

/** Upsert resiliente: batch normale; su errore di batch (es. una geom degenere)
 *  ripiega riga-per-riga senza abortire l'intera ingestion. */
async function upsertInBatches(rows: OmiUpsertRow[], batchSize = 200): Promise<UpsertOutcome> {
  const client = createServiceClient() as unknown as SupabaseRpcClient;
  const out: UpsertOutcome = { total: 0, droppedGeom: [], failed: [] };
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.rpc('omi_upsert_quotations', { p_rows: batch });
    if (!error) {
      out.total += batch.length;
    } else {
      console.warn(`  ⚠ batch ${i / batchSize} fallito (${error.message}); ripiego riga-per-riga`);
      for (const row of batch) {
        const r = await upsertSingleRow(client, row);
        if (r === 'fail') out.failed.push(row.link_zona);
        else {
          out.total += 1;
          if (r === 'ok-nogeom') out.droppedGeom.push(row.link_zona);
        }
      }
    }
    if ((i / batchSize) % 10 === 0 || i + batchSize >= rows.length) {
      console.log(`  upsert ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }
  return out;
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
  const { total, droppedGeom, failed } = await upsertInBatches(rows);
  console.log(`\n✓ Ingestion completata: ${total} righe upsertate (semestre ${report.semestre}).`);
  if (droppedGeom.length > 0) {
    console.warn(
      `  ⚠ ${droppedGeom.length} righe inserite senza geometria (geom degenere ⇒ fallback comune). ` +
        `Applicare la migrazione 0022 per recuperarle.`,
    );
  }
  if (failed.length > 0) {
    console.error(`  ✗ ${failed.length} righe NON inserite: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('\n✗ Ingestion fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
