import { z } from 'zod';
import type { EnrichResult } from '@/lib/valuation/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';
import type { ValuationNarrative } from '@/lib/narration/types';
import type { PeriziaCompsSummary, PeriziaInput } from './types';

/**
 * Logica PURA della perizia (node-testabile, niente rete/SDK):
 *  - `PERIZIA_SYSTEM`: grounding ("spiega, NON calcolare; cifre solo dall'input").
 *  - `buildPeriziaInput`: assembla il dossier di soli valori già calcolati.
 *  - `PERIZIA_JSON_SCHEMA` / `PeriziaSchema`: structured output + ri-validazione.
 * Gli allegati immagine/PDF sono aggiunti dall'adapter (`anthropic.ts`).
 */

export const PERIZIA_SYSTEM = [
  "Sei un perito immobiliare di un'agenzia italiana. Redigi una PERIZIA INTERNA formale",
  'in italiano, SPIEGANDO una valutazione GIÀ CALCOLATA da un motore deterministico.',
  '',
  'Regole tassative:',
  '- NON calcolare e NON inventare numeri: usa ESCLUSIVAMENTE le cifre presenti nel dossier JSON.',
  '- Se un dato è null/assente, scrivi "non disponibile" — non stimarlo né dedurlo.',
  '- Cita la zona OMI, i comparabili (attribuiti ad annunci/transazioni), i dati catastali e l\'APE quando presenti.',
  '- Integra i documenti allegati (planimetria/APE) solo per descrivere ciò che è leggibile, senza ricavarne nuove cifre di valore.',
  '- Il valore è una STIMA orientativa (prezzi di offerta scontati / dati di mercato), non una garanzia.',
  '- Dichiara esplicitamente assunzioni e limiti. Tono professionale e sobrio; niente entusiasmo commerciale.',
  '- Rispondi SOLO con i campi di prosa richiesti (ciascuno 1–5 frasi); i numeri li renderizza il sistema.',
].join('\n');

function compsSummary(e: EnrichResult): PeriziaCompsSummary {
  if (e.comparables.length === 0) return { count: 0, eur_mq_min: null, eur_mq_max: null };
  const corrected = e.comparables.map((c) => c.correctedEurMq);
  return { count: e.comparables.length, eur_mq_min: Math.min(...corrected), eur_mq_max: Math.max(...corrected) };
}

export interface PeriziaContext {
  referenceId: string;
  indirizzo: string | null;
  comune: string | null;
  propertyType: string | null;
  superficieDichiarataMq: number | null;
}

export interface PeriziaExtras {
  catasto: CatastoData | null;
  documentFacts: DocumentFacts | null;
  narrative: ValuationNarrative | null;
  transcripts: string[];
}

/** EnrichResult (+ contesto + fatti documentali) → dossier di grounding. Solo valori calcolati. */
export function buildPeriziaInput(e: EnrichResult, ctx: PeriziaContext, extras: PeriziaExtras): PeriziaInput {
  return {
    reference_id: ctx.referenceId,
    indirizzo: ctx.indirizzo,
    comune: ctx.comune,
    property_type: ctx.propertyType,
    superficie_dichiarata_mq: ctx.superficieDichiarataMq,
    superficie_commerciale_mq: e.superficie_commerciale_mq,
    zona_omi_id: e.zona_omi_id,
    fallback_level: e.fallback_level,
    omi_eur_mq_min: e.omi_eur_mq_min,
    omi_eur_mq_max: e.omi_eur_mq_max,
    estimate_min: e.estimate_min,
    estimate_max: e.estimate_max,
    confidence_label: e.confidence.label,
    confidence_score: e.confidence.score,
    breakdown: e.breakdown.map((b) => ({ label: b.label, contributo: b.contributo })),
    comparables: compsSummary(e),
    catasto: extras.catasto,
    document_facts: extras.documentFacts,
    narrative: extras.narrative,
    voice_transcripts: extras.transcripts,
  };
}

export function buildPeriziaUserContent(input: PeriziaInput): string {
  return [
    'Redigi la perizia usando SOLO i dati del dossier qui sotto (JSON) e gli eventuali documenti allegati.',
    'Non aggiungere cifre nuove.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n');
}

const SECTION_KEYS = [
  'premessa',
  'identificazione_immobile',
  'descrizione',
  'dati_catastali',
  'analisi_mercato',
  'analisi_comparabili',
  'considerazioni_documentali',
  'metodo_valutativo',
  'conclusione_valore',
  'limiti_assunzioni',
] as const;

export const PERIZIA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    premessa: { type: 'string' },
    identificazione_immobile: { type: 'string' },
    descrizione: { type: 'string' },
    dati_catastali: { type: 'string' },
    analisi_mercato: { type: 'string' },
    analisi_comparabili: { type: 'string' },
    considerazioni_documentali: { type: 'string' },
    metodo_valutativo: { type: 'string' },
    conclusione_valore: { type: 'string' },
    limiti_assunzioni: { type: 'string' },
  },
  required: [...SECTION_KEYS],
} as const;

export const PeriziaSchema = z.object({
  premessa: z.string(),
  identificazione_immobile: z.string(),
  descrizione: z.string(),
  dati_catastali: z.string(),
  analisi_mercato: z.string(),
  analisi_comparabili: z.string(),
  considerazioni_documentali: z.string(),
  metodo_valutativo: z.string(),
  conclusione_valore: z.string(),
  limiti_assunzioni: z.string(),
});
