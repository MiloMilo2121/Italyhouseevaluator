/**
 * Tipi del layer "document intelligence" (V2 Step 3 / Filone 2).
 *
 * Principio cardine invariato: **il numero lo calcola il motore deterministico**
 * (`enrich`); gli estrattori LLM/vision e il reconciler **estraggono fatti** e
 * **propongono** correzioni agli input, ma NON producono mai un prezzo. Il
 * guardrail puro `applyReconciliation` decide cosa è abbastanza affidabile da
 * applicare (whitelist + validatore per-campo + soglia di confidenza); il resto
 * diventa un "dubbio" mostrato all'agente.
 *
 * Tutti i port ritornano `… | null` (degrado pulito) come il `Narrator`.
 */

export type DocumentKind = 'planimetria' | 'ape' | 'nota_vocale';
export type DocumentStatus = 'uploaded' | 'processing' | 'extracted' | 'failed';
export type UploadedBy = 'seller' | 'agent';

/** Livello di affidabilità auto-assegnato dall'LLM a un fatto/override. */
export type ConfidenceLevel = 'alta' | 'media' | 'bassa';

/** Campi di SubjectProperty che un override documentale può correggere (whitelist chiusa). */
export type OverrideField =
  | 'propertyType'
  | 'superficieMq'
  | 'condizioni'
  | 'classeEnergetica'
  | 'piano'
  | 'pianiEdificio'
  | 'ascensore'
  | 'balconeAreaMq'
  | 'terrazzoAreaMq'
  | 'giardinoAreaMq'
  | 'cantinaAreaMq'
  | 'soffittaAreaMq';

/** Whitelist a runtime (deve restare allineata al tipo `OverrideField`). */
export const OVERRIDE_FIELDS: readonly OverrideField[] = [
  'propertyType',
  'superficieMq',
  'condizioni',
  'classeEnergetica',
  'piano',
  'pianiEdificio',
  'ascensore',
  'balconeAreaMq',
  'terrazzoAreaMq',
  'giardinoAreaMq',
  'cantinaAreaMq',
  'soffittaAreaMq',
];

/** File binario passato a estrattori/trascrittore (base64 + mime). */
export interface DocumentFile {
  data: string; // base64
  mime: string;
}

// ---- Estrazioni tipizzate (vision) ----
export interface ApeExtraction {
  classeEnergetica: string | null;
  epglNrenKwhMqAnno: number | null; // EPgl,nren (kWh/m²·anno) se leggibile
  leggibile: boolean;
  confidence: ConfidenceLevel;
}

export interface PlanimetriaExtraction {
  vani: number | null;
  superficieCalpestabileMq: number | null;
  locali: string[];
  leggibile: boolean;
  confidence: ConfidenceLevel;
}

// ---- Catasto (lookup deterministico) ----
export interface CatastoData {
  categoria: string | null; // es. A/2
  classe: string | null;
  consistenzaVani: number | null;
  renditaEuro: number | null;
  superficieCatastaleMq: number | null;
  foglio: string | null;
  particella: string | null;
  subalterno: string | null;
}

export interface CatastoQuery {
  indirizzo: string | null;
  comune: string | null;
}

// ---- Note vocali (trascrizione) ----
export interface VoiceNoteExtraction {
  transcript: string;
  sintesi: string | null;
  puntiChiave: string[];
}

// ---- Riconciliazione (proposta LLM) ----
export interface ReconciliationOverride {
  field: OverrideField;
  value: unknown;
  confidence: ConfidenceLevel;
  sourceDocument: string; // 'ape' | 'planimetria' | 'catasto' | 'nota_vocale'
  justification: string;
}

export interface ReconciliationDubbio {
  campo: string;
  dichiarato: unknown;
  rilevato: unknown;
  nota: string;
}

export interface ReconciliationResult {
  overrides: ReconciliationOverride[];
  dubbi: ReconciliationDubbio[];
  sintesi: string;
}

/** Sottoinsieme dichiarato del subject confrontato dal reconciler (niente PII). */
export interface DeclaredSubjectFacts {
  propertyType: string;
  superficieMq: number;
  condizioni: string;
  classeEnergetica: string | null;
  piano: number | null;
  pianiEdificio: number | null;
  ascensore: boolean;
}

export interface ReconcilerInput {
  declared: DeclaredSubjectFacts;
  ape: ApeExtraction | null;
  planimetria: PlanimetriaExtraction | null;
  catasto: CatastoData | null;
  voiceNotes: VoiceNoteExtraction[];
}

/** Forma persistita in valuation_requests.document_facts (jsonb). */
export interface DocumentFacts {
  appliedOverrides: ReconciliationOverride[];
  dubbi: ReconciliationDubbio[];
  sintesi: string;
  generatedAt: string; // ISO
}

// ---- Port iniettabili ----
export interface DocumentVisionExtractor {
  extractApe(file: DocumentFile): Promise<ApeExtraction | null>;
  extractPlanimetria(file: DocumentFile): Promise<PlanimetriaExtraction | null>;
}

export interface Transcriber {
  transcribe(file: DocumentFile): Promise<VoiceNoteExtraction | null>;
}

export interface CatastoProvider {
  lookup(query: CatastoQuery): Promise<CatastoData | null>;
}

export interface DocumentReconciler {
  reconcile(input: ReconcilerInput): Promise<ReconciliationResult | null>;
}
