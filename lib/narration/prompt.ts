import { z } from 'zod';
import type { EnrichResult } from '@/lib/valuation/types';
import type { NarrationCompsSummary, NarrationInput } from './types';

/**
 * Logica PURA della narrazione (node-testabile, nessuna chiamata di rete):
 *  - `NARRATION_SYSTEM`: le regole di grounding ("spiega, non calcolare").
 *  - `buildNarrationInput`: EnrichResult → payload di soli numeri calcolati.
 *  - `NarrativeSchema`: forma Zod della risposta (campi di sola prosa) usata
 *    sia per lo structured output (zodOutputFormat) sia per validare.
 */

export const NARRATION_FONTE = 'annunci pubblici (Immobiliare.it / Idealista), aggregati internamente';

export const NARRATION_SYSTEM = [
  "Sei un analista immobiliare di un'agenzia italiana. Il tuo compito è SPIEGARE in italiano",
  'una valutazione GIÀ CALCOLATA da un motore deterministico, non rifarla.',
  '',
  'Regole tassative:',
  '- NON calcolare e NON inventare numeri: usa esclusivamente le cifre presenti nel JSON di input.',
  "- Se un dato è null o assente, scrivi \"non disponibile\" — non stimarlo né dedurlo.",
  '- Cita la zona OMI e i comparabili quando presenti; attribuisci i comparabili agli annunci pubblici.',
  '- Il valore è una STIMA orientativa basata su prezzi di offerta scontati, non una garanzia di prezzo.',
  '- Tono professionale, sobrio e onesto; niente entusiasmo commerciale, niente promesse.',
  '- Rispondi solo con i campi di prosa richiesti, ciascuno 1–3 frasi.',
].join('\n');

function compsSummary(e: EnrichResult): NarrationCompsSummary {
  if (e.comparables.length === 0) {
    return { count: 0, eur_mq_min: null, eur_mq_max: null, fonte: NARRATION_FONTE };
  }
  const corrected = e.comparables.map((c) => c.correctedEurMq);
  return {
    count: e.comparables.length,
    eur_mq_min: Math.min(...corrected),
    eur_mq_max: Math.max(...corrected),
    fonte: NARRATION_FONTE,
  };
}

export interface NarrationContext {
  referenceId: string;
  indirizzo: string | null;
  comune: string | null;
}

/** EnrichResult (+ contesto indirizzo) → grounding payload. Solo valori calcolati, nessun dato del lead. */
export function buildNarrationInput(enrich: EnrichResult, ctx: NarrationContext): NarrationInput {
  return {
    reference_id: ctx.referenceId,
    indirizzo: ctx.indirizzo,
    comune: ctx.comune,
    zona_omi_id: enrich.zona_omi_id,
    fallback_level: enrich.fallback_level,
    superficie_commerciale_mq: enrich.superficie_commerciale_mq,
    omi_eur_mq_min: enrich.omi_eur_mq_min,
    omi_eur_mq_max: enrich.omi_eur_mq_max,
    estimate_min: enrich.estimate_min,
    estimate_max: enrich.estimate_max,
    confidence_label: enrich.confidence.label,
    confidence_score: enrich.confidence.score,
    breakdown: enrich.breakdown.map((b) => ({ label: b.label, contributo: b.contributo })),
    comparables: compsSummary(enrich),
  };
}

/** Il prompt utente è il payload di grounding serializzato (niente prosa libera). */
export function buildNarrationUserContent(input: NarrationInput): string {
  return [
    'Spiega questa valutazione usando SOLO i numeri qui sotto (JSON). Non aggiungere cifre nuove.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n');
}

export const NarrativeSchema = z.object({
  sintesi: z.string().min(1),
  spiegazione_valore: z.string().min(1),
  commento_comparabili: z.string().min(1),
  contesto_mercato: z.string().min(1),
  nota_confidenza: z.string().min(1),
});

/**
 * JSON Schema della risposta per lo structured output dell'SDK
 * (`jsonSchemaOutputFormat`). Usiamo il JSON schema, non `zodOutputFormat`,
 * perché quest'ultimo richiede zod v4 mentre il progetto è su zod v3:
 * `NarrativeSchema` (v3) resta l'autorità per la validazione a runtime.
 */
export const NARRATIVE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sintesi: { type: 'string' },
    spiegazione_valore: { type: 'string' },
    commento_comparabili: { type: 'string' },
    contesto_mercato: { type: 'string' },
    nota_confidenza: { type: 'string' },
  },
  required: ['sintesi', 'spiegazione_valore', 'commento_comparabili', 'contesto_mercato', 'nota_confidenza'],
} as const;
