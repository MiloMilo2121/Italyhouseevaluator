import { z } from 'zod';
import type { CoefficientSet, MeritCoefficients, OmiStato } from './types';

/**
 * Parsing/typing e accessori del coefficient_set (puro). `parseCoefficientSet`
 * valida il jsonb grezzo (già recuperato dal chiamante) in un CoefficientSet
 * tipato e fallisce rumorosamente su payload malformati, invece di propagare
 * NaN a valle.
 */

const numberRecord = z.record(z.string(), z.number());

const confidenceLabelRecord = z.object({
  Alta: z.number(),
  Media: z.number(),
  Bassa: z.number(),
});

const surfaceWeightsSchema = z.object({
  superficie_utile: z.number(),
  balcone_scoperto: z.number(),
  balcone_coperto: z.number(),
  terrazzo_scoperto: z.number(),
  giardino_appartamento: z.number(),
  cantina_non_comunicante: z.number(),
  soffitta_non_comunicante: z.number(),
  default_area_balcone_mq: z.number(),
  default_area_giardino_mq: z.number(),
  box_auto_mq_default: z.number(),
  box_auto_coeff: z.number(),
});

const pianoTableSchema = z.object({
  interrato: z.number(),
  seminterrato: z.number(),
  terra_rialzato: z.number(),
  basso_con_asc: z.number(),
  basso_senza_asc: z.number(),
  alto_con_asc: z.number(),
  alto_senza_asc: z.number(),
  ultimo_con_asc: z.number(),
  ultimo_senza_asc: z.number(),
  default: z.number(),
});

const meritCoefficientsSchema = z.object({
  piano: pianoTableSchema,
  classe_energetica: numberRecord,
  luminosita_esposizione: z.object({ default: z.number() }),
  stato_corrective: z.object({
    Ottimo: z.number(),
    Normale: z.number(),
    Scadente: z.number(),
  }),
  range: z.object({
    confidence_multiplier: confidenceLabelRecord,
    min_rel_halfwidth: confidenceLabelRecord,
  }),
});

const coefficientSetRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  active: z.boolean(),
  superficie_weights: surfaceWeightsSchema,
  merit_coefficients: meritCoefficientsSchema,
});

export function parseCoefficientSet(raw: unknown): CoefficientSet {
  const parsed = coefficientSetRowSchema.parse(raw);
  return {
    id: parsed.id,
    name: parsed.name,
    version: parsed.version,
    active: parsed.active,
    surfaceWeights: parsed.superficie_weights,
    meritCoefficients: parsed.merit_coefficients,
  };
}

/** Normalizza la classe energetica e ritorna il fattore (default 1.00 se ignota). */
export function classeEnergeticaFactor(m: MeritCoefficients, classe: string | null): number {
  if (classe == null) return m.classe_energetica['default'] ?? 1;
  const key = classe.trim().toUpperCase();
  return m.classe_energetica[key] ?? m.classe_energetica['default'] ?? 1;
}

export function statoCorrectiveFactor(m: MeritCoefficients, stato: OmiStato): number {
  return m.stato_corrective[stato] ?? 1;
}
