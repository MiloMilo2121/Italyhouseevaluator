import type {
  AnniRistrutturazione,
  Condizioni,
  Intent,
  PianoLabel,
  PropertyType,
  Riscaldamento,
} from '@/lib/valuation/types';

/**
 * Stato del funnel (§12). Tutti i campi sono opzionali: la state machine
 * accumula le risposte. La logica è pura e testata in node; la UI React la
 * consuma. Nessun browser storage — lo stato vive solo in React.
 */

export type StepId =
  | 'indirizzo'
  | 'mappa'
  | 'tipologia'
  | 'superficie'
  | 'dotazioni'
  | 'condizioni'
  | 'piano'
  | 'riscaldamento'
  | 'classe_energetica'
  | 'intento'
  | 'contatti';

export interface Dotazioni {
  balcone: boolean;
  garage: boolean;
  giardino: boolean;
}

export interface FunnelData {
  // indirizzo + geo
  address_raw?: string;
  address_normalized?: string;
  comune?: string;
  cap?: string;
  lat?: number;
  lng?: number;
  // immobile
  property_type?: PropertyType;
  superficie_mq?: number;
  stanze?: number;
  ascensore?: boolean;
  dotazioni?: Dotazioni;
  condizioni?: Condizioni;
  anni_ristrutturazione?: AnniRistrutturazione; // sotto-domanda di condizioni
  piano?: number;
  piano_label?: PianoLabel;
  piani_edificio?: number;
  riscaldamento?: Riscaldamento; // step opzionale (SALTA)
  classe_energetica?: string; // step opzionale (SALTA)
  intent?: Intent;
  // contatti + consensi
  nome?: string;
  cognome?: string;
  email?: string;
  telefono?: string;
  consent_privacy?: boolean;
  consent_marketing?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<keyof FunnelData, string>>;
}

export interface StepDef {
  id: StepId;
  /** Step opzionale: ammette "SALTA". */
  optional: boolean;
  /** Branching/skip-logic: lo step è mostrato solo se applicabile. */
  isApplicable: (d: FunnelData) => boolean;
  /** Validazione per-step. */
  validate: (d: FunnelData) => ValidationResult;
}
