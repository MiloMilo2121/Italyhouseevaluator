import type { FunnelData } from './types';

/**
 * Mappa lo stato del funnel nel body del contratto §9. Gli step opzionali
 * saltati restano assenti (spread condizionale per `exactOptionalPropertyTypes`),
 * così gli `.optional()`/`.default()` dello schema si applicano. Ritorna
 * `unknown`: la validazione autorevole resta nella route (`ValuationRequestSchema`).
 */
export function toApiPayload(d: FunnelData): unknown {
  return {
    nome: d.nome,
    cognome: d.cognome,
    email: d.email,
    telefono: d.telefono,
    consent_privacy: d.consent_privacy ?? false,
    consent_marketing: d.consent_marketing ?? false,
    intent: d.intent,
    address_raw: d.address_raw,
    ...(d.address_normalized ? { address_normalized: d.address_normalized } : {}),
    ...(d.comune ? { comune: d.comune } : {}),
    ...(d.cap ? { cap: d.cap } : {}),
    lat: d.lat,
    lng: d.lng,
    property_type: d.property_type,
    superficie_mq: d.superficie_mq,
    stanze: d.stanze,
    ascensore: d.ascensore ?? false,
    dotazioni: d.dotazioni ?? { balcone: false, garage: false, giardino: false },
    condizioni: d.condizioni,
    ...(d.anni_ristrutturazione ? { anni_ristrutturazione: d.anni_ristrutturazione } : {}),
    piano: d.piano,
    ...(d.piano_label ? { piano_label: d.piano_label } : {}),
    piani_edificio: d.piani_edificio,
    ...(d.riscaldamento ? { riscaldamento: d.riscaldamento } : {}),
    ...(d.classe_energetica ? { classe_energetica: d.classe_energetica } : {}),
  };
}
