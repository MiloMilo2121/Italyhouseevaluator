import type { CompSource } from '@/lib/valuation/types';
import { round2 } from '@/lib/valuation/util';

/**
 * Correzione offerta→rogito (knowledge base V2). I prezzi degli ANNUNCI sono di
 * offerta e vanno scontati del margine medio di trattativa; i rogiti sono già
 * prezzi di chiusura (nessuno sconto). Lo sconto è parametrico per macro-area
 * (Sondaggio Banca d'Italia–Tecnoborsa–OMI): Nord-Est ~5% è il default per il
 * core Veneto di Delfino. Valori calibrabili, da aggiornare semestralmente.
 */

export type MacroArea = 'nord_ovest' | 'nord_est' | 'centro' | 'sud_isole';

export const OFFER_TO_ROGITO_DISCOUNT: Record<MacroArea, number> = {
  nord_ovest: 0.06,
  nord_est: 0.05, // default Veneto/Nord-Est
  centro: 0.077,
  sud_isole: 0.1,
};

export const NATIONAL_DISCOUNT = 0.077; // media nazionale Q4-2025

/** Default per Delfino (core Veneto). */
export const DEFAULT_MACRO_AREA: MacroArea = 'nord_est';

export function discountRate(macroArea?: MacroArea): number {
  return macroArea ? OFFER_TO_ROGITO_DISCOUNT[macroArea] : NATIONAL_DISCOUNT;
}

/** €/mq corretto: sconto applicato SOLO agli annunci (offerta); rogiti invariati. */
export function discountedEurMq(eurMq: number, source: CompSource | undefined, macroArea?: MacroArea): number {
  if (source === 'annuncio') return round2(eurMq * (1 - discountRate(macroArea)));
  return round2(eurMq);
}
