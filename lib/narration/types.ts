/**
 * Tipi della narrazione LLM (V2 Step 2). Principio cardine: **il numero lo
 * calcola il motore deterministico, l'LLM lo SPIEGA**. Per questo:
 *  - `NarrationInput` contiene SOLO valori già calcolati (grounding): l'LLM non
 *    riceve nulla da cui ricalcolare, e non vede dati del lead (no PII).
 *  - `ValuationNarrative` è SOLO prosa nominata (nessuna cifra autorevole):
 *    il report deterministico renderizza i numeri e interleava questa prosa.
 */

/** Sintesi aggregata dei comparabili passata all'LLM (mai foto/descrizioni). */
export interface NarrationCompsSummary {
  count: number;
  eur_mq_min: number | null;
  eur_mq_max: number | null;
  fonte: string;
}

/** Payload di grounding: derivato da EnrichResult, solo numeri/etichette già calcolati. */
export interface NarrationInput {
  reference_id: string;
  indirizzo: string | null;
  comune: string | null;
  zona_omi_id: string | null;
  fallback_level: string;
  superficie_commerciale_mq: number;
  omi_eur_mq_min: number | null;
  omi_eur_mq_max: number | null;
  estimate_min: number | null;
  estimate_max: number | null;
  confidence_label: string;
  confidence_score: number;
  breakdown: { label: string; contributo: number }[];
  comparables: NarrationCompsSummary;
}

/** Relazione narrata: campi di sola PROSA (italiano). Nessuna cifra grezza. */
export interface ValuationNarrative {
  sintesi: string;
  spiegazione_valore: string;
  commento_comparabili: string;
  contesto_mercato: string;
  nota_confidenza: string;
}

/** Port iniettabile: l'edge (Anthropic) o il NullNarrator lo implementano. */
export interface Narrator {
  narrate(input: NarrationInput): Promise<ValuationNarrative | null>;
}
