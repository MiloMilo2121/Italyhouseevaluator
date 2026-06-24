import { z } from 'zod';
import type { CorrectionRequest } from '../ports';

/**
 * Prompt della correzione LLM (Fase 4), PURO. Il modello riceve un valore GIÀ
 * calcolato + il contesto zona e propone SOLO un fattore moltiplicativo entro
 * la banda dichiarata; NON ricalcola il valore, NON propone cifre in €. Il clamp
 * resta comunque hard lato nostro (difesa in profondità).
 */

export const CORRECTION_SYSTEM = [
  "Sei un perito immobiliare. Ricevi un valore di mercato GIÀ calcolato da un motore",
  "deterministico e alcuni dati di contesto sulla zona. Il tuo compito è proporre una",
  'PICCOLA correzione del valore basata su appetibilità/contesto, NON ricalcolarlo.',
  '',
  'Regole tassative:',
  '- Proponi SOLO un fattore moltiplicativo `factor_raw` vicino a 1.00.',
  '- NON proporre cifre in €, NON ricalcolare il valore.',
  '- Se il contesto non giustifica aggiustamenti, proponi 1.00.',
  '- Motiva in 1-2 frasi citando il contesto (appetibilità, scostamento prezzi web vs OMI).',
  '- Resta entro la banda indicata: oltre, verrà comunque tagliato.',
].join('\n');

export function buildCorrectionUserContent(req: CorrectionRequest): string {
  const z = req.zoneIntel;
  const ctx = z
    ? [
        `Appetibilità zona: ${z.desirability_label} (${z.desirability_score}/100)`,
        `Prezzi web vs OMI: ${z.omi_deviation_flag}${z.omi_deviation_pct != null ? ` (${(z.omi_deviation_pct * 100).toFixed(1)}%)` : ''}`,
        z.note_qualitative ? `Note: ${z.note_qualitative}` : '',
        z.venduto_recente ? `Venduto: ${z.venduto_recente}` : '',
        z.vendibile_recente ? `Vendibile: ${z.vendibile_recente}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Contesto zona non disponibile.';
  const band = (req.clampMaxPct * 100).toFixed(0);
  return [
    `Valore deterministico (punto): € ${Math.round(req.estimateDeterministic.pointEstimate)}`,
    `Zona OMI: ${req.dossier.zonaOmiId ?? 'n/d'} · risoluzione: ${req.dossier.fallbackLevel} · confidenza: ${req.dossier.confidenceLabel} · comparabili: ${req.dossier.compsCount}`,
    '',
    ctx,
    '',
    `Proponi factor_raw entro ±${band}% (cioè tra ${(1 - req.clampMaxPct).toFixed(2)} e ${(1 + req.clampMaxPct).toFixed(2)}).`,
  ].join('\n');
}

export const RawCorrectionSchema = z.object({
  factor_raw: z.number(),
  motivazione: z.string(),
});

export const CORRECTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    factor_raw: { type: 'number' },
    motivazione: { type: 'string' },
  },
  required: ['factor_raw', 'motivazione'],
} as const;
