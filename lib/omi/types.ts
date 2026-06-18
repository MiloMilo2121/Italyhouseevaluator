import type { FallbackLevel, OmiStato } from '@/lib/valuation/types';

/**
 * Tipi per l'ingestion OMI (Agenzia delle Entrate). Tutta la trasformazione è
 * pura e testabile; la scrittura su DB è isolata nello script CLI.
 */

/** Una quotazione parsata dal file VALORI (una riga = zona × tipologia × stato). */
export interface ParsedQuotation {
  linkZona: string; // identificativo reale OMI (campo LinkZona, es. PD00000035)
  zona: string; // codice zona OMI (campo Zona, es. B1) — usato per la chiave geometrica
  comuneCode: string; // Belfiore (campo OMI Comune_amm)
  comuneAmm: string | null; // denominazione (campo OMI Comune_descrizione)
  fascia: string;
  tipologia: string;
  stato: OmiStato;
  comprMin: number;
  comprMax: number;
  locMin: number | null; // ~10% = 0 nel dato grezzo → null
  locMax: number | null;
  semestre: string;
}

/** Una zona parsata dal file ZONE. */
export interface ParsedZone {
  linkZona: string;
  comuneCode: string;
  comuneAmm: string | null;
  zonaDescr: string | null;
}

/** Geometria di una zona estratta dal KML.
 *  Struttura = coordinate GeoJSON MultiPolygon: lista di poligoni, ognuno
 *  composto da anello esterno + eventuali fori (innerBoundaryIs).
 *  polygons[i] = [anelloEsterno, foro1, foro2, …]; ogni anello è [lng,lat][]. */
export interface ParsedGeometry {
  linkZona: string;
  polygons: [number, number][][][];
}

/** Riga pronta per l'upsert in omi_quotations (geometria come GeoJSON). */
export interface OmiUpsertRow {
  link_zona: string;
  comune_code: string;
  comune_amm: string | null;
  fascia: string;
  tipologia: string;
  stato: OmiStato;
  compr_min: number;
  compr_max: number;
  loc_min: number | null;
  loc_max: number | null;
  semestre: string;
  /** GeoJSON MultiPolygon (o null se la zona non ha geometria valida). */
  geom_geojson: GeoJsonMultiPolygon | null;
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

/** Motivo di scarto/segnalazione di una geometria o riga. */
export interface IngestionFlag {
  kind:
    | 'geometry_outside_italy'
    | 'geometry_invalid_ring'
    | 'geometry_key_collision'
    | 'missing_geometry'
    | 'malformed_row'
    | 'unknown_stato'
    | 'unlabeled_placemark';
  linkZona: string | null;
  detail: string;
}

export interface IngestionReport {
  semestre: string;
  quotationsParsed: number;
  zonesParsed: number;
  geometriesParsed: number;
  upsertRows: number;
  rowsWithGeometry: number;
  rowsWithoutGeometry: number; // es. gap Forlì-Cesena
  flags: IngestionFlag[];
}

export interface IngestionResult {
  rows: OmiUpsertRow[];
  report: IngestionReport;
}

/** Riutilizzo del livello di fallback per la risoluzione zona. */
export type { FallbackLevel };
