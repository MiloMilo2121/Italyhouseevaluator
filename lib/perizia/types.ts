import type { CatastoData, DocumentFacts, DocumentFile } from '@/lib/documents/types';
import type { ValuationNarrative } from '@/lib/narration/types';

/**
 * Tipi della perizia interna (V2 Step 4). Una perizia formale generata in
 * UN'UNICA passata long-context che "carica tutto una volta": l'intero dossier
 * già calcolato/estratto (enrich, comparabili, document_facts, catasto,
 * narrazione, trascrizioni) + i documenti sorgente allegati quando presenti.
 *
 * Principio cardine invariato: l'LLM SCRIVE le sezioni di prosa; i NUMERI
 * autorevoli restano quelli del motore e li renderizza codice deterministico
 * (`render.ts`). L'LLM non inventa cifre.
 */

/** Sintesi comparabili passata al grounding (mai foto/descrizioni). */
export interface PeriziaCompsSummary {
  count: number;
  eur_mq_min: number | null;
  eur_mq_max: number | null;
}

/** Dossier di grounding: solo valori già calcolati/estratti. */
export interface PeriziaInput {
  reference_id: string;
  indirizzo: string | null;
  comune: string | null;
  property_type: string | null;
  superficie_dichiarata_mq: number | null;
  superficie_commerciale_mq: number;
  zona_omi_id: string | null;
  fallback_level: string;
  omi_eur_mq_min: number | null;
  omi_eur_mq_max: number | null;
  estimate_min: number | null;
  estimate_max: number | null;
  confidence_label: string;
  confidence_score: number;
  breakdown: { label: string; contributo: number }[];
  comparables: PeriziaCompsSummary;
  catasto: CatastoData | null;
  document_facts: DocumentFacts | null;
  narrative: ValuationNarrative | null;
  voice_transcripts: string[];
}

/** Sezioni di prosa della perizia (italiano, niente cifre grezze inventate). */
export interface PeriziaSections {
  premessa: string;
  identificazione_immobile: string;
  descrizione: string;
  dati_catastali: string;
  analisi_mercato: string;
  analisi_comparabili: string;
  considerazioni_documentali: string;
  metodo_valutativo: string;
  conclusione_valore: string;
  limiti_assunzioni: string;
}

/** Forma persistita in valuation_requests.perizia (jsonb). */
export interface Perizia {
  sections: PeriziaSections;
  generatedAt: string;
  model: string | null;
}

/** Allegato sorgente per il grounding visivo (planimetria/APE). Riusa DocumentFile. */
export type DocumentAttachment = DocumentFile;

/** Port iniettabile: l'edge (Anthropic) o il NullPeriziaWriter lo implementano. */
export interface PeriziaWriter {
  write(input: PeriziaInput, attachments?: DocumentAttachment[]): Promise<PeriziaSections | null>;
}
