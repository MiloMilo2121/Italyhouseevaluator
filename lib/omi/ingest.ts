import { EXPECTED_VALORI_HEADERS, EXPECTED_ZONE_HEADERS, parseOmiCsv } from './csv';
import { polygonsToMultiPolygon, sanitizeZonePolygons } from './geometry';
import { parseKmlGeometries } from './kml';
import {
  parseComprValue,
  parseFascia,
  parseLocValue,
  parseOmiStato,
  isValidSemestre,
} from './normalize';
import type {
  GeoJsonMultiPolygon,
  IngestionFlag,
  IngestionResult,
  OmiUpsertRow,
  ParsedQuotation,
  ParsedZone,
} from './types';

/**
 * Pipeline di ingestion OMI, PURA: prende i contenuti dei file (già decodificati
 * UTF-8) e produce le righe di upsert + un report. La scrittura su DB è nello
 * script CLI. Join VALORI ↔ ZONE ↔ perimetri (KML) tramite chiave LinkZona.
 */

export interface ParseValoriResult {
  quotations: ParsedQuotation[];
  flags: IngestionFlag[];
  malformedLineNumbers: number[];
}

export function parseValori(valoriCsv: string, semestre: string): ParseValoriResult {
  const { rows, malformedLineNumbers } = parseOmiCsv(valoriCsv, EXPECTED_VALORI_HEADERS);
  const quotations: ParsedQuotation[] = [];
  const flags: IngestionFlag[] = [];

  for (const r of rows) {
    const linkZona = r['LinkZona'] ?? '';
    const stato = parseOmiStato(r['Stato']);
    if (stato == null) {
      flags.push({ kind: 'unknown_stato', linkZona, detail: `stato "${r['Stato']}" non riconosciuto` });
      continue;
    }
    const comprMin = parseComprValue(r['Compr_min']);
    const comprMax = parseComprValue(r['Compr_max']);
    // Senza dato di compravendita la riga non alimenta omi_quotations (es. solo locazione).
    if (comprMin == null || comprMax == null) continue;

    quotations.push({
      linkZona,
      zona: r['Zona'] ?? '',
      comuneCode: r['Comune_amm'] ?? '',
      comuneAmm: r['Comune_descrizione'] || null,
      fascia: parseFascia(r['Fascia']) ?? 'R',
      tipologia: r['Descr_Tipologia'] ?? '',
      stato,
      comprMin,
      comprMax,
      locMin: parseLocValue(r['Loc_min']),
      locMax: parseLocValue(r['Loc_max']),
      semestre,
    });
  }

  return { quotations, flags, malformedLineNumbers };
}

export function parseZone(zoneCsv: string): { zones: ParsedZone[]; malformedLineNumbers: number[] } {
  const { rows, malformedLineNumbers } = parseOmiCsv(zoneCsv, EXPECTED_ZONE_HEADERS);
  const zones: ParsedZone[] = rows.map((r) => ({
    linkZona: r['LinkZona'] ?? '',
    comuneCode: r['Comune_amm'] ?? '',
    comuneAmm: r['Comune_descrizione'] || null,
    zonaDescr: r['Zona_Descr'] || null,
  }));
  return { zones, malformedLineNumbers };
}

export interface IngestInput {
  valoriCsv: string;
  zoneCsv: string;
  /** Contenuto KML singolo (build interna del map). Alternativo a geometryMap. */
  kml?: string;
  /** Map LinkZona-geometrico → MultiPolygon già costruito (es. directory di KML). */
  geometryMap?: Map<string, GeoJsonMultiPolygon>;
  semestre: string;
}

/** Chiave di join geometrico VALORI ↔ KML: `${Comune_amm}_${Zona}` normalizzata. */
export function geomKey(comuneCode: string, zona: string): string {
  return `${comuneCode}_${zona}`.trim().toUpperCase();
}

/** Costruisce la mappa LinkZona → MultiPolygon sanificato dal KML. */
export function buildGeometryMap(kml: string): {
  map: Map<string, GeoJsonMultiPolygon>;
  flags: IngestionFlag[];
} {
  const { geometries, unlabeledPlacemarks } = parseKmlGeometries(kml);
  const map = new Map<string, GeoJsonMultiPolygon>();
  const flags: IngestionFlag[] = [];

  if (unlabeledPlacemarks > 0) {
    flags.push({ kind: 'unlabeled_placemark', linkZona: null, detail: `${unlabeledPlacemarks} placemark senza chiave zona valida` });
  }

  for (const g of geometries) {
    const { polygons, flags: geomFlags } = sanitizeZonePolygons(g.linkZona, g.polygons);
    flags.push(...geomFlags);
    if (polygons == null) continue;
    // Collisione di chiave geometrica: due placemark per la stessa zona (raro;
    // l'ultimo vince come prima, ma ora è segnalato invece che silenzioso).
    if (map.has(g.linkZona)) {
      flags.push({ kind: 'geometry_key_collision', linkZona: g.linkZona, detail: 'più perimetri per la stessa chiave zona' });
    }
    map.set(g.linkZona, polygonsToMultiPolygon(polygons));
  }

  return { map, flags };
}

export function ingestOmi(input: IngestInput): IngestionResult {
  if (!isValidSemestre(input.semestre)) {
    throw new Error(`Semestre non valido: "${input.semestre}" (atteso 'YYYY-S', es. '2024-2').`);
  }

  const valori = parseValori(input.valoriCsv, input.semestre);
  const zone = parseZone(input.zoneCsv);
  const geometry = input.geometryMap != null
    ? { map: input.geometryMap, flags: [] as IngestionFlag[] }
    : buildGeometryMap(input.kml ?? '');

  const flags: IngestionFlag[] = [...valori.flags, ...geometry.flags];
  for (const ln of valori.malformedLineNumbers) {
    flags.push({ kind: 'malformed_row', linkZona: null, detail: `VALORI riga ${ln}` });
  }
  for (const ln of zone.malformedLineNumbers) {
    flags.push({ kind: 'malformed_row', linkZona: null, detail: `ZONE riga ${ln}` });
  }

  const rows: OmiUpsertRow[] = [];
  const missingGeomReported = new Set<string>();
  let rowsWithGeometry = 0;
  let rowsWithoutGeometry = 0;

  for (const q of valori.quotations) {
    const key = geomKey(q.comuneCode, q.zona);
    const geom = geometry.map.get(key) ?? null;
    if (geom == null) {
      rowsWithoutGeometry++;
      if (!missingGeomReported.has(key)) {
        missingGeomReported.add(key);
        // Gap perimetri (es. provincia di Forlì-Cesena assente nei poligoni).
        flags.push({ kind: 'missing_geometry', linkZona: q.linkZona, detail: `nessun perimetro KML per zona ${key}` });
      }
    } else {
      rowsWithGeometry++;
    }

    rows.push({
      link_zona: q.linkZona,
      comune_code: q.comuneCode,
      comune_amm: q.comuneAmm,
      fascia: q.fascia,
      tipologia: q.tipologia,
      stato: q.stato,
      compr_min: q.comprMin,
      compr_max: q.comprMax,
      loc_min: q.locMin,
      loc_max: q.locMax,
      semestre: q.semestre,
      geom_geojson: geom,
    });
  }

  return {
    rows,
    report: {
      semestre: input.semestre,
      quotationsParsed: valori.quotations.length,
      zonesParsed: zone.zones.length,
      geometriesParsed: geometry.map.size,
      upsertRows: rows.length,
      rowsWithGeometry,
      rowsWithoutGeometry,
      flags,
    },
  };
}
