import type { PropertyType } from '@/lib/valuation/types';

/**
 * Gruppi di mercato omogenei per la ricerca dei comparabili. I €/mq NON sono
 * confrontabili tra tipologie di mercato diverse (un appartamento e una villa
 * hanno dinamiche di prezzo diverse che la griglia di omogeneizzazione
 * piano/classe/stato non cattura). Si cercano comp SOLO nello stesso gruppo.
 */
export const MARKET_GROUPS: readonly (readonly PropertyType[])[] = [
  ['appartamento', 'attico', 'mansarda', 'loft'], // residenziale verticale
  ['villa', 'villetta_schiera', 'casa_indipendente'], // residenziale orizzontale
  ['rustico_casale'], // a sé
] as const;

/** Ritorna le tipologie del gruppo di mercato a cui appartiene `t` (incluso `t`). */
export function marketGroupFor(t: PropertyType): PropertyType[] {
  const group = MARKET_GROUPS.find((g) => g.includes(t));
  return group ? [...group] : [t];
}
