/**
 * Tipi di dominio del motore di valutazione. Nessuna logica qui.
 * I campi nullable sono espliciti (`| null`, mai opzionali) dove servono a una
 * serializzazione/hash deterministica; i campi metratura esplicita delle
 * pertinenze sono opzionali (assenti ⇒ si usa la logica boolean+default).
 */

export type PropertyType =
  | 'appartamento'
  | 'attico'
  | 'mansarda'
  | 'casa_indipendente'
  | 'loft'
  | 'rustico_casale'
  | 'villa'
  | 'villetta_schiera';

export type Condizioni = 'nuova' | 'ristrutturata' | 'parz_ristrutturata' | 'da_ristrutturare';
export type OmiStato = 'Ottimo' | 'Normale' | 'Scadente';
export type PianoLabel = 'terra' | 'rialzato' | 'seminterrato' | 'interrato';
export type AnniRistrutturazione = '<5' | '5-10' | '>10';
export type Riscaldamento = 'autonomo' | 'centralizzato' | 'assente';
export type Intent = 'vendere_ora' | 'vendere_dopo' | 'comprare_ora' | 'comprare_dopo';
export type FallbackLevel = 'none' | 'nearest' | 'comune' | 'prior_only';
export type ConfidenceLabel = 'Alta' | 'Media' | 'Bassa';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Subject già geocodato passato al motore. Il geocoding (M5) è a monte di enrich(). */
export interface SubjectProperty {
  propertyType: PropertyType;
  superficieMq: number;
  stanze: number | null;
  ascensore: boolean;
  hasBalcone: boolean;
  hasGarage: boolean;
  hasGiardino: boolean;
  condizioni: Condizioni;
  anniRistrutturazione: AnniRistrutturazione | null;
  piano: number | null;
  pianoLabel: PianoLabel | null;
  pianiEdificio: number | null;
  riscaldamento: Riscaldamento | null;
  classeEnergetica: string | null;
  location: GeoPoint;
  comuneCode?: string | null;
  // Metrature esplicite delle pertinenze (override delle aree di default).
  // Quando il funnel le raccoglierà (M5) avranno priorità sui booleani.
  balconeAreaMq?: number;
  balconeCoperto?: boolean;
  terrazzoAreaMq?: number;
  giardinoAreaMq?: number;
  cantinaAreaMq?: number;
  soffittaAreaMq?: number;
}

// ---- Coefficient set (forma tipizzata dei payload jsonb) ----
export interface SurfaceWeights {
  superficie_utile: number;
  balcone_scoperto: number;
  balcone_coperto: number;
  terrazzo_scoperto: number;
  giardino_appartamento: number;
  cantina_non_comunicante: number;
  soffitta_non_comunicante: number;
  default_area_balcone_mq: number;
  default_area_giardino_mq: number;
  box_auto_mq_default: number;
  box_auto_coeff: number;
}

export interface PianoTable {
  interrato: number;
  seminterrato: number;
  terra_rialzato: number;
  basso_con_asc: number;
  basso_senza_asc: number;
  alto_con_asc: number;
  alto_senza_asc: number;
  ultimo_con_asc: number;
  ultimo_senza_asc: number;
  default: number;
}

export interface RangeParams {
  confidence_multiplier: Record<ConfidenceLabel, number>;
  min_rel_halfwidth: Record<ConfidenceLabel, number>;
}

export interface MeritCoefficients {
  piano: PianoTable;
  classe_energetica: Record<string, number>;
  luminosita_esposizione: { default: number };
  stato_corrective: Record<OmiStato, number>;
  range: RangeParams;
}

export interface CoefficientSet {
  id: string;
  name: string;
  version: number;
  active: boolean;
  surfaceWeights: SurfaceWeights;
  meritCoefficients: MeritCoefficients;
}

// ---- Risoluzione OMI (output del port) ----
export interface OmiQuotationRow {
  linkZona: string;
  comuneCode: string;
  fascia: string;
  tipologia: string;
  stato: OmiStato;
  comprMin: number;
  comprMax: number;
  semestre: string;
}

export interface OmiResolution {
  zonaOmiId: string | null;
  fallbackLevel: FallbackLevel;
  rows: OmiQuotationRow[];
  semestre: string | null;
}

// ---- Comparabili (scaffold Fase 2) ----
export interface Comparable {
  id: string;
  distanceMeters: number;
  superficieCommercialeMq: number;
  pricePerMq: number;
  saleDate: string;
  stato: OmiStato;
  sameOmiZone: boolean;
}

export interface WeightedComparable extends Comparable {
  weight: number;
}

export interface Estimate {
  min: number;
  max: number;
  pointEstimate: number;
}

// ---- Superficie ----
export interface SurfaceComponent {
  label: string;
  areaMq: number;
  coeff: number;
  commercialMq: number;
}

export interface SurfaceResult {
  superficieCommercialeMq: number;
  contributions: SurfaceComponent[];
}

// ---- Selezione riga OMI ----
export interface OmiRowSelection {
  row: OmiQuotationRow | null;
  requestedStato: OmiStato;
  usedStato: OmiStato | null;
  /** 1.00 se la riga esiste; correttivo dal set se si è ripiegato su Normale. */
  stateCorrectiveApplied: number;
}

// ---- Merito ----
export interface MeritResult {
  coefficient: number;
  factors: Record<string, number>;
  /** Chiave della cella piano selezionata (per spiegabilità/test). */
  pianoKey: string;
}

// ---- Breakdown + confidenza ----
export interface BreakdownLine {
  label: string;
  contributo: number;
}

export interface ConfidenceResult {
  score: number;
  label: ConfidenceLabel;
  fsd: number;
}

// ---- Output unico del motore (§6.8) ----
export interface EnrichResult {
  superficie_commerciale_mq: number;
  zona_omi_id: string | null;
  fallback_level: FallbackLevel;
  omi_eur_mq_min: number | null;
  omi_eur_mq_max: number | null;
  coefficients_applied: Record<string, number>;
  estimate_min: number | null;
  estimate_max: number | null;
  confidence: ConfidenceResult;
  breakdown: BreakdownLine[];
}
