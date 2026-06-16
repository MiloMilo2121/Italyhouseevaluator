import { z } from 'zod';
import type { Intent, SubjectProperty } from '@/lib/valuation/types';

/**
 * Contratto API §9. Valida il body HTTP grezzo e si rifina nei tipi del dominio
 * (lead identity + SubjectProperty). Questo è il contratto che anche il funnel
 * di Claude Design (M5) dovrà rispettare. Definito ora perché il test di
 * validazione (consent_privacy=false ⇒ reject) lo richiede.
 */

export const ValuationRequestSchema = z.object({
  // contatti + consensi
  nome: z.string().min(1),
  cognome: z.string().min(1),
  email: z.string().email(),
  telefono: z.string().min(1),
  consent_privacy: z.boolean().refine((v) => v === true, {
    message: 'Il consenso privacy è obbligatorio',
  }),
  consent_marketing: z.boolean().default(false),
  intent: z.enum(['vendere_ora', 'vendere_dopo', 'comprare_ora', 'comprare_dopo']),

  // indirizzo + geo (lat/lng catturati lato client dall'autocomplete)
  address_raw: z.string().min(1),
  address_normalized: z.string().optional(),
  comune: z.string().optional(),
  cap: z.string().optional(),
  lat: z.number(),
  lng: z.number(),

  // attributi immobile
  property_type: z.enum([
    'appartamento',
    'attico',
    'mansarda',
    'casa_indipendente',
    'loft',
    'rustico_casale',
    'villa',
    'villetta_schiera',
  ]),
  superficie_mq: z.number().positive(),
  stanze: z.number().int().positive(),
  ascensore: z.boolean(),
  dotazioni: z
    .object({
      balcone: z.boolean().default(false),
      garage: z.boolean().default(false),
      giardino: z.boolean().default(false),
    })
    .default({}),
  condizioni: z.enum(['nuova', 'ristrutturata', 'parz_ristrutturata', 'da_ristrutturare']),
  anni_ristrutturazione: z.enum(['<5', '5-10', '>10']).optional(),
  piano: z.number().int(),
  piano_label: z.enum(['terra', 'rialzato', 'seminterrato', 'interrato']).optional(),
  piani_edificio: z.number().int().positive(),
  riscaldamento: z.enum(['autonomo', 'centralizzato', 'assente']).optional(),
  classe_energetica: z.string().optional(),
});

export type ValuationRequestInput = z.infer<typeof ValuationRequestSchema>;

/** Priority flag del lead: l'intento "ora" è hot (vendere_ora in cima). */
export function isPriorityIntent(intent: Intent): boolean {
  return intent === 'vendere_ora' || intent === 'comprare_ora';
}

export interface LeadInput {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  consent_privacy: boolean;
  consent_marketing: boolean;
  intent: Intent;
  is_priority: boolean;
}

export function toLeadInput(p: ValuationRequestInput): LeadInput {
  return {
    nome: p.nome,
    cognome: p.cognome,
    email: p.email,
    telefono: p.telefono,
    consent_privacy: p.consent_privacy,
    consent_marketing: p.consent_marketing,
    intent: p.intent,
    is_priority: isPriorityIntent(p.intent),
  };
}

/** Mappa il body validato nel SubjectProperty atteso dal motore. */
export function toSubjectProperty(p: ValuationRequestInput): SubjectProperty {
  return {
    propertyType: p.property_type,
    superficieMq: p.superficie_mq,
    stanze: p.stanze,
    ascensore: p.ascensore,
    hasBalcone: p.dotazioni.balcone,
    hasGarage: p.dotazioni.garage,
    hasGiardino: p.dotazioni.giardino,
    condizioni: p.condizioni,
    anniRistrutturazione: p.anni_ristrutturazione ?? null,
    piano: p.piano,
    pianoLabel: p.piano_label ?? null,
    pianiEdificio: p.piani_edificio,
    riscaldamento: p.riscaldamento ?? null,
    classeEnergetica: p.classe_energetica ?? null,
    location: { lat: p.lat, lng: p.lng },
    comuneCode: null,
  };
}
