import type { GeoPoint, OmiQuotationRow } from '@/lib/valuation/types';

/**
 * Fixtures OMI di test (poligoni + quotazioni), così i test non dipendono dai
 * dati reali. Tre zone non sovrapposte vicino a Milano + punti di prova.
 * Anelli in formato [lng, lat] (chiusi).
 */

export interface ZoneFixture {
  id: string;
  ring: [number, number][];
  rows: OmiQuotationRow[];
}

const SEM = '2024-2';
const COMUNE = 'F205'; // Milano (Belfiore)

export const ZONE_A_RING: [number, number][] = [
  [9.18, 45.46],
  [9.2, 45.46],
  [9.2, 45.475],
  [9.18, 45.475],
  [9.18, 45.46],
];

export const ZONE_B_RING: [number, number][] = [
  [9.21, 45.46],
  [9.23, 45.46],
  [9.23, 45.475],
  [9.21, 45.475],
  [9.21, 45.46],
];

export const ZONE_EMPTY_RING: [number, number][] = [
  [9.24, 45.46],
  [9.26, 45.46],
  [9.26, 45.475],
  [9.24, 45.475],
  [9.24, 45.46],
];

// Zona A: dati completi (Ottimo / Normale / Scadente).
export const QUOTATIONS_A: OmiQuotationRow[] = [
  { linkZona: 'A', comuneCode: COMUNE, fascia: 'B', tipologia: 'Abitazioni civili', stato: 'Ottimo', comprMin: 3500, comprMax: 4200, semestre: SEM },
  { linkZona: 'A', comuneCode: COMUNE, fascia: 'B', tipologia: 'Abitazioni civili', stato: 'Normale', comprMin: 2800, comprMax: 3400, semestre: SEM },
  { linkZona: 'A', comuneCode: COMUNE, fascia: 'B', tipologia: 'Abitazioni civili', stato: 'Scadente', comprMin: 2100, comprMax: 2600, semestre: SEM },
];

// Zona B: solo Normale (per testare stato mancante → correttivo).
export const QUOTATIONS_B: OmiQuotationRow[] = [
  { linkZona: 'B', comuneCode: COMUNE, fascia: 'C', tipologia: 'Abitazioni civili', stato: 'Normale', comprMin: 2200, comprMax: 2700, semestre: SEM },
];

export const ZONE_A: ZoneFixture = { id: 'A', ring: ZONE_A_RING, rows: QUOTATIONS_A };
export const ZONE_B: ZoneFixture = { id: 'B', ring: ZONE_B_RING, rows: QUOTATIONS_B };
export const ZONE_EMPTY: ZoneFixture = { id: 'B-empty', ring: ZONE_EMPTY_RING, rows: [] };

export const POINT_IN_A: GeoPoint = { lat: 45.467, lng: 9.19 };
export const POINT_IN_B: GeoPoint = { lat: 45.467, lng: 9.22 };
export const POINT_IN_ZONE_NO_OMI: GeoPoint = { lat: 45.467, lng: 9.25 };
export const POINT_OUTSIDE: GeoPoint = { lat: 45.5, lng: 9.3 };
