import type { Comparable } from '@/lib/valuation/types';

/** Comparabile fixture (annuncio, attributi = subject "neutro" salvo override). */
export function makeComp(over: Partial<Comparable> = {}): Comparable {
  return {
    id: 'c1',
    distanceMeters: 200,
    superficieCommercialeMq: 100,
    pricePerMq: 2000,
    saleDate: '2025-10-01',
    stato: 'Normale',
    sameOmiZone: true,
    source: 'annuncio',
    piano: 1,
    pianoLabel: null,
    pianiEdificio: 5,
    ascensore: true,
    classeEnergetica: 'D',
    ...over,
  };
}
