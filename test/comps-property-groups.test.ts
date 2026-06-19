import { describe, it, expect } from 'vitest';
import { marketGroupFor, MARKET_GROUPS } from '@/lib/comps/property-groups';
import type { PropertyType } from '@/lib/valuation/types';

describe('gruppi di mercato comparabili', () => {
  it('appartamento e attico sono nello stesso gruppo (verticale)', () => {
    const g = marketGroupFor('appartamento');
    expect(g).toContain('appartamento');
    expect(g).toContain('attico');
    expect(g).toContain('mansarda');
    expect(g).toContain('loft');
    expect(g).not.toContain('villa');
  });

  it('villa raggruppa il residenziale orizzontale, non gli appartamenti', () => {
    const g = marketGroupFor('villa');
    expect(g).toEqual(expect.arrayContaining(['villa', 'villetta_schiera', 'casa_indipendente']));
    expect(g).not.toContain('appartamento');
  });

  it('rustico_casale è un gruppo a sé', () => {
    expect(marketGroupFor('rustico_casale')).toEqual(['rustico_casale']);
  });

  it('ogni tipologia appartiene a esattamente un gruppo', () => {
    const all: PropertyType[] = [
      'appartamento', 'attico', 'mansarda', 'casa_indipendente',
      'loft', 'rustico_casale', 'villa', 'villetta_schiera',
    ];
    for (const t of all) {
      const groups = MARKET_GROUPS.filter((g) => g.includes(t));
      expect(groups).toHaveLength(1);
    }
  });
});
