import { z } from 'zod';
import type { ZoneIntelligenceQuery } from '@/lib/valuation/ports';
import type { ZoneIntelligence } from '@/lib/valuation/types';

/**
 * Ricerca web di "zone intelligence" (Fase 3), parte PURA: system prompt,
 * serializzazione query, schema dell'output grezzo e NORMALIZZAZIONE
 * deterministica. Il modello riporta SOLO fatti/prezzi osservati citando fonti;
 * NON stima il valore dell'immobile. Lo scostamento vs OMI lo calcola il NOSTRO
 * codice (non il modello), coerente col principio "il numero non lo inventa l'LLM".
 */

export const ZONE_RESEARCH_SYSTEM = [
  "Sei un analista di mercato immobiliare. Fai ricerca WEB sulla zona di un immobile in Italia",
  'e riporti SOLO fatti verificabili, citando le fonti.',
  '',
  'Regole tassative:',
  '- NON stimare il valore dell\'immobile né proporre una valutazione: quello lo fa un motore a parte.',
  '- Riporta prezzi medi al m² SOLO se li trovi su fonti reali (annunci/portali/report), con la fonte.',
  '- Se un dato non è reperibile, lascialo null: non inventarlo né dedurlo.',
  '- desirability_score 0..100 = appetibilità/desiderabilità della zona (servizi, domanda, trend).',
  '- venduto_recente / vendibile_recente: sintesi qualitativa breve (1-2 frasi) di transato e offerta.',
  '- Cita almeno una fonte (title + url) per ogni dato di prezzo.',
  '- Rispondi in italiano.',
].join('\n');

export function buildZoneResearchUserContent(q: ZoneIntelligenceQuery): string {
  const omi =
    q.omiEurMqMin != null && q.omiEurMqMax != null
      ? `${q.omiEurMqMin}–${q.omiEurMqMax} €/m² (OMI di riferimento, per confronto)`
      : 'non disponibile';
  return [
    `Zona/Comune: ${q.comune ?? 'n/d'}${q.zonaOmiId ? ` (zona OMI ${q.zonaOmiId})` : ''}`,
    `Indirizzo: ${q.indirizzo ?? 'n/d'}`,
    `Tipologia: ${q.propertyType}`,
    `Quotazione OMI di zona: ${omi}`,
    '',
    'Ricerca: appetibilità della zona, prezzi medi al m² osservati sul web,',
    'transato recente (venduto) e offerta attuale (vendibile), conferma o smentita',
    'dei prezzi rispetto all\'OMI. Riporta le fonti.',
  ].join('\n');
}

/** Output grezzo atteso dal modello (solo ciò che il modello popola). */
export const RawZoneResearchSchema = z.object({
  desirability_score: z.number(),
  note_qualitative: z.string(),
  web_eur_mq_min: z.number().nullable(),
  web_eur_mq_max: z.number().nullable(),
  venduto_recente: z.string().nullable(),
  vendibile_recente: z.string().nullable(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
});
export type RawZoneResearch = z.infer<typeof RawZoneResearchSchema>;

/** JSON schema per response_format (Perplexity, OpenAI-compatible). */
export const ZONE_RESEARCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    desirability_score: { type: 'number' },
    note_qualitative: { type: 'string' },
    web_eur_mq_min: { type: ['number', 'null'] },
    web_eur_mq_max: { type: ['number', 'null'] },
    venduto_recente: { type: ['string', 'null'] },
    vendibile_recente: { type: ['string', 'null'] },
    sources: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'] },
    },
  },
  required: ['desirability_score', 'note_qualitative'],
} as const;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface NormalizeOpts {
  deviationThreshold: number; // es. 0.10 ⇒ |scostamento|≤10% = allineato
  model: string;
  retrievedAt: string; // ISO
}

/** Raw → ZoneIntelligence: clamp score, label, e calcolo DETERMINISTICO dello scostamento vs OMI. */
export function normalizeZoneIntelligence(
  raw: RawZoneResearch,
  q: ZoneIntelligenceQuery,
  opts: NormalizeOpts,
): ZoneIntelligence {
  const score = clamp(Math.round(raw.desirability_score), 0, 100);
  const label = score >= 66 ? 'alta' : score >= 33 ? 'media' : 'bassa';

  let deviationPct: number | null = null;
  let flag: ZoneIntelligence['omi_deviation_flag'] = 'unknown';
  if (raw.web_eur_mq_min != null && raw.web_eur_mq_max != null && q.omiEurMqMin != null && q.omiEurMqMax != null) {
    const webMid = (raw.web_eur_mq_min + raw.web_eur_mq_max) / 2;
    const omiMid = (q.omiEurMqMin + q.omiEurMqMax) / 2;
    if (omiMid > 0) {
      deviationPct = Math.round(((webMid - omiMid) / omiMid) * 1000) / 1000;
      if (Math.abs(deviationPct) <= opts.deviationThreshold) flag = 'aligned';
      else flag = deviationPct > 0 ? 'web_higher' : 'web_lower';
    }
  }

  return {
    desirability_score: score,
    desirability_label: label,
    note_qualitative: raw.note_qualitative,
    web_eur_mq_min: raw.web_eur_mq_min,
    web_eur_mq_max: raw.web_eur_mq_max,
    omi_deviation_pct: deviationPct,
    omi_deviation_flag: flag,
    venduto_recente: raw.venduto_recente,
    vendibile_recente: raw.vendibile_recente,
    sources: raw.sources,
    model: opts.model,
    retrieved_at: opts.retrievedAt,
  };
}
