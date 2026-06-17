import type {
  AnniRistrutturazione,
  Condizioni,
  PianoLabel,
  PropertyType,
  Riscaldamento,
  SubjectProperty,
} from '@/lib/valuation/types';

/**
 * Mapper PURO inverso di `toSubjectProperty`: riga DB valuation_requests →
 * SubjectProperty, per ri-eseguire `enrich` sul subject corretto dai documenti
 * (la route legge `select('*')`, quindi ha tutte le colonne, incluse
 * anni_ristrutturazione/piano_label/riscaldamento assenti dal DetailRow).
 * Le colonne numeriche di PostgREST possono arrivare come stringa → coercizione.
 */

export interface ValuationRequestRow {
  property_type: string;
  superficie_mq: number | string;
  stanze: number | string | null;
  ascensore: boolean | null;
  has_balcone: boolean | null;
  has_garage: boolean | null;
  has_giardino: boolean | null;
  condizioni: string;
  anni_ristrutturazione: string | null;
  piano: number | string | null;
  piano_label: string | null;
  piani_edificio: number | string | null;
  riscaldamento: string | null;
  classe_energetica: string | null;
  lat: number | string | null;
  lng: number | string | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function rowToSubjectProperty(row: ValuationRequestRow): SubjectProperty {
  return {
    propertyType: row.property_type as PropertyType,
    superficieMq: num(row.superficie_mq) ?? 0,
    stanze: num(row.stanze),
    ascensore: !!row.ascensore,
    hasBalcone: !!row.has_balcone,
    hasGarage: !!row.has_garage,
    hasGiardino: !!row.has_giardino,
    condizioni: row.condizioni as Condizioni,
    anniRistrutturazione: (row.anni_ristrutturazione as AnniRistrutturazione | null) ?? null,
    piano: num(row.piano),
    pianoLabel: (row.piano_label as PianoLabel | null) ?? null,
    pianiEdificio: num(row.piani_edificio),
    riscaldamento: (row.riscaldamento as Riscaldamento | null) ?? null,
    classeEnergetica: row.classe_energetica ?? null,
    location: { lat: num(row.lat) ?? 0, lng: num(row.lng) ?? 0 },
    comuneCode: null,
  };
}
