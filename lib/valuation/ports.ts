import type { GeoPoint, OmiResolution, SubjectProperty, Comparable } from './types';

/**
 * Il SEAM iniettabile del motore. Tutto ciò che tocca PostGIS/DB sta dietro
 * queste interfacce; le funzioni di valutazione restano pure.
 */

/**
 * Risoluzione spaziale + recupero candidati OMI, SOLO. Nessuna business logic.
 * Possiede la fallback ladder (none → nearest → comune → prior_only) perché è
 * una decisione intrinsecamente spaziale. M3 = impl PostGIS; M2 = fake da fixture.
 */
export interface OmiResolver {
  resolve(
    point: GeoPoint,
    opts?: { comuneCode?: string | null; tipologia?: string },
  ): Promise<OmiResolution>;
}

export interface ComparablesQueryOpts {
  radiusMeters?: number;
  /** Raggio largo per il campione edonico (default ~3 km). */
  wideRadiusMeters?: number;
  /** Numero di comparabili più vicini per l'MCA (split a valle). */
  nearestN?: number;
  limit?: number;
  months?: number;
  omiZone?: string | null;
}

/** Fase 1 ritorna []. V2 = KNN PostGIS su comps (SupabaseComparablesProvider). */
export interface ComparablesProvider {
  find(subject: SubjectProperty, opts?: ComparablesQueryOpts): Promise<Comparable[]>;
}
