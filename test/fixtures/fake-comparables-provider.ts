import type { ComparablesProvider } from '@/lib/valuation/ports';
import type { Comparable } from '@/lib/valuation/types';

/** Provider comparabili fake. Fase 1: ritorna [] (nessun comparabile). */
export class FakeComparablesProvider implements ComparablesProvider {
  constructor(private readonly comps: Comparable[] = []) {}

  async find(): Promise<Comparable[]> {
    return this.comps;
  }
}

export const emptyComparablesProvider = new FakeComparablesProvider([]);
