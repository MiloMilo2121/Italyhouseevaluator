import type {
  AppliedCorrection,
  Comparable,
  Estimate,
  GeoPoint,
  OmiResolution,
  PropertyType,
  SubjectProperty,
  ZoneIntelligence,
} from './types';

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

/**
 * Zone intelligence (Fase 3): ricerca web (Perplexity) per appetibilità zona,
 * venduto/vendibile, conferma prezzi medi. Entra DOPO le OMI come controllo +
 * contesto. Gated (PERPLEXITY_API_KEY): assente ⇒ provider non iniettato.
 */
export interface ZoneIntelligenceQuery {
  comune: string | null;
  zonaOmiId: string | null;
  indirizzo: string | null;
  location: GeoPoint;
  omiEurMqMin: number | null;
  omiEurMqMax: number | null;
  propertyType: PropertyType;
}
export interface ZoneIntelligenceProvider {
  research(q: ZoneIntelligenceQuery): Promise<ZoneIntelligence | null>;
}

/**
 * Correzione LLM VINCOLATA (Fase 4): propone solo un FATTORE moltiplicativo; il
 * clamp e l'applicazione sono codice puro (non l'LLM). Gated (ANTHROPIC_API_KEY
 * + CORRECTION_ENABLED).
 */
export interface CorrectionRequest {
  estimateDeterministic: Estimate;
  zoneIntel: ZoneIntelligence | null;
  dossier: {
    zonaOmiId: string | null;
    fallbackLevel: string;
    confidenceLabel: string;
    compsCount: number;
  };
  clampMaxPct: number;
}
export interface RawCorrection {
  factor_raw: number;
  motivazione: string;
}
export interface BoundedCorrector {
  readonly model: string;
  correct(req: CorrectionRequest): Promise<RawCorrection | null>;
}

/** Fase 1 ritorna []. V2 = KNN PostGIS su comps (SupabaseComparablesProvider). */
export interface ComparablesProvider {
  find(subject: SubjectProperty, opts?: ComparablesQueryOpts): Promise<Comparable[]>;
}
