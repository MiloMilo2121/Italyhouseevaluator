import type { FunnelData, StepDef, ValidationResult } from './types';

/**
 * Registro ordinato degli step (§12). Solo dati + predicati puri, niente React.
 * Il branching `condizioni → anni_ristrutturazione` è una sotto-domanda dentro
 * lo step `condizioni` (la validate la richiede solo se `ristrutturata`).
 */

const ok: ValidationResult = { ok: true, errors: {} };

function err(errors: ValidationResult['errors']): ValidationResult {
  return { ok: Object.keys(errors).length === 0, errors };
}

export const STEPS: readonly StepDef[] = [
  {
    id: 'indirizzo',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err({
        ...(d.address_raw ? {} : { address_raw: 'Inserisci un indirizzo' }),
        ...(d.lat != null && d.lng != null ? {} : { lat: 'Seleziona un indirizzo dai suggerimenti' }),
      }),
  },
  {
    id: 'mappa',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err(d.lat != null && d.lng != null ? {} : { lat: 'Conferma la posizione sulla mappa' }),
  },
  {
    id: 'tipologia',
    optional: false,
    isApplicable: () => true,
    validate: (d) => err(d.property_type ? {} : { property_type: 'Scegli la tipologia' }),
  },
  {
    id: 'superficie',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err(d.superficie_mq != null && d.superficie_mq > 0 ? {} : { superficie_mq: 'Inserisci la superficie' }),
  },
  {
    id: 'dotazioni',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err({
        ...(d.stanze != null && d.stanze > 0 ? {} : { stanze: 'Inserisci il numero di stanze' }),
        ...(d.ascensore != null ? {} : { ascensore: 'Indica se c’è l’ascensore' }),
      }),
  },
  {
    id: 'condizioni',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err({
        ...(d.condizioni ? {} : { condizioni: 'Scegli lo stato' }),
        ...(d.condizioni === 'ristrutturata' && !d.anni_ristrutturazione
          ? { anni_ristrutturazione: 'Da quanti anni è ristrutturata?' }
          : {}),
      }),
  },
  {
    id: 'piano',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err({
        ...(d.piano != null ? {} : { piano: 'Inserisci il piano' }),
        ...(d.piani_edificio != null && d.piani_edificio > 0
          ? {}
          : { piani_edificio: 'Inserisci i piani dell’edificio' }),
      }),
  },
  {
    id: 'riscaldamento',
    optional: true,
    isApplicable: () => true,
    validate: () => ok, // opzionale: sempre valido (SALTA)
  },
  {
    id: 'classe_energetica',
    optional: true,
    isApplicable: () => true,
    validate: () => ok, // opzionale: sempre valido (SALTA)
  },
  {
    id: 'intento',
    optional: false,
    isApplicable: () => true,
    validate: (d) => err(d.intent ? {} : { intent: 'Scegli un’opzione' }),
  },
  {
    id: 'contatti',
    optional: false,
    isApplicable: () => true,
    validate: (d) =>
      err({
        ...(d.nome ? {} : { nome: 'Nome obbligatorio' }),
        ...(d.cognome ? {} : { cognome: 'Cognome obbligatorio' }),
        ...(d.email && /.+@.+\..+/.test(d.email) ? {} : { email: 'Email non valida' }),
        ...(d.telefono ? {} : { telefono: 'Telefono obbligatorio' }),
        ...(d.consent_privacy === true ? {} : { consent_privacy: 'Il consenso privacy è obbligatorio' }),
      }),
  },
] as const;
