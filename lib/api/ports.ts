import type { LeadInput } from '@/lib/schemas/valuation-request.schema';
import type { EnrichResult } from '@/lib/valuation/types';

/**
 * Port (seam iniettabile) della API route §9. Persistenza ed email stanno
 * dietro queste interfacce, così l'orchestratore handleValuation è testabile
 * con fake (zero DB/Resend).
 */

/** Campi della valuation_request da persistere (oltre al lead). snake_case = colonne. */
export interface RequestPersistInput {
  reference_id: string;
  input_hash: string;
  coefficient_set_id: string;
  model_version: number;
  property_type: string;
  superficie_mq: number;
  stanze: number | null;
  ascensore: boolean;
  has_balcone: boolean;
  has_garage: boolean;
  has_giardino: boolean;
  condizioni: string;
  anni_ristrutturazione: string | null;
  piano: number | null;
  piano_label: string | null;
  piani_edificio: number | null;
  riscaldamento: string | null;
  classe_energetica: string | null;
  address_raw: string;
  address_normalized: string | null;
  comune: string | null;
  cap: string | null;
  lat: number;
  lng: number;
}

export interface PersistResult {
  referenceId: string;
  /** true se la richiesta è stata creata ora; false se re-submit idempotente. */
  created: boolean;
}

export interface ValuationPersistence {
  /** Inserisce lead + request COMMITTED (atomico, dedup su input_hash). */
  createLeadAndRequest(lead: LeadInput, request: RequestPersistInput): Promise<PersistResult>;
  /** Aggiorna i campi intelligence dopo l'enrichment. */
  updateEnrichment(referenceId: string, result: EnrichResult): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
