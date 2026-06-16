import { parseCoefficientSet } from '@/lib/valuation/coefficients';
import type { CoefficientSet } from '@/lib/valuation/types';

/**
 * Replica tipata del coefficient_set seed (migrazione 0008). I test asseriscono
 * contro questi numeri. Passa per parseCoefficientSet così valida anche il parser.
 */
export const DEFAULT_COEFFICIENT_SET_RAW = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'default',
  version: 1,
  active: true,
  superficie_weights: {
    superficie_utile: 1.0,
    balcone_scoperto: 0.25,
    balcone_coperto: 0.35,
    terrazzo_scoperto: 0.25,
    giardino_appartamento: 0.15,
    cantina_non_comunicante: 0.25,
    soffitta_non_comunicante: 0.25,
    default_area_balcone_mq: 6,
    default_area_giardino_mq: 25,
    box_auto_mq_default: 15,
    box_auto_coeff: 0.45,
  },
  merit_coefficients: {
    piano: {
      interrato: 0.8,
      seminterrato: 0.85,
      terra_rialzato: 0.95,
      basso_con_asc: 1.0,
      basso_senza_asc: 0.95,
      alto_con_asc: 1.0,
      alto_senza_asc: 0.8,
      ultimo_con_asc: 1.05,
      ultimo_senza_asc: 0.85,
      default: 1.0,
    },
    classe_energetica: {
      A4: 1.1,
      A3: 1.085,
      A2: 1.07,
      A1: 1.055,
      A: 1.05,
      B: 1.03,
      C: 1.015,
      D: 1.0,
      E: 0.985,
      F: 0.97,
      G: 0.955,
      default: 1.0,
    },
    luminosita_esposizione: { default: 1.0 },
    stato_corrective: { Ottimo: 1.1, Normale: 1.0, Scadente: 0.85 },
    range: {
      confidence_multiplier: { Alta: 1.0, Media: 1.25, Bassa: 1.6 },
      min_rel_halfwidth: { Alta: 0.04, Media: 0.08, Bassa: 0.14 },
    },
  },
};

export const defaultCoefficientSet: CoefficientSet =
  parseCoefficientSet(DEFAULT_COEFFICIENT_SET_RAW);
