import type { GeoPoint, OmiQuotationRow } from '@/lib/valuation/types';

/**
 * Port di interrogazione spaziale OMI. Espone SOLO primitive di risoluzione
 * spaziale / recupero candidati (ST_Contains, KNN <->, righe per comune). La
 * fallback ladder e ogni decisione vivono nel resolver (TS), non qui né in SQL.
 */

export interface ZoneCandidate {
  linkZona: string;
  comuneAmm: string | null;
  rows: OmiQuotationRow[]; // tutte le righe per stato della zona
}

export interface OmiQueryClient {
  /** Semestre più recente ingerito (max(semestre)). */
  latestSemestre(): Promise<string | null>;

  /** Zona che CONTIENE il punto (ST_Contains). */
  zoneContaining(point: GeoPoint, semestre: string, tipologia: string): Promise<ZoneCandidate | null>;

  /** Zona più vicina entro maxMeters (operatore <->). */
  nearestZone(
    point: GeoPoint,
    maxMeters: number,
    semestre: string,
    tipologia: string,
  ): Promise<ZoneCandidate | null>;

  /** Righe a livello comune (già aggregate a una per stato), fallback comune. */
  comuneRows(comuneCode: string, semestre: string, tipologia: string): Promise<OmiQuotationRow[]>;
}
