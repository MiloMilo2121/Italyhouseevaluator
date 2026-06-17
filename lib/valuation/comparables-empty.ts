import type { ComparablesProvider } from './ports';
import type { Comparable } from './types';

/**
 * Provider comparabili di produzione per la Fase 1: nessun comparabile (la
 * tabella comps è vuota), quindi l'enrich collassa sul prior OMI (α = 0).
 */
export const emptyComparablesProvider: ComparablesProvider = {
  async find(): Promise<Comparable[]> {
    return [];
  },
};
