import {
  ValuationRequestSchema,
  type LeadInput,
  type ValuationRequestInput,
} from '@/lib/schemas/valuation-request.schema';
import type {
  EmailMessage,
  EmailSender,
  PersistResult,
  RequestPersistInput,
  ValuationPersistence,
} from '@/lib/api/ports';
import type { OmiResolver } from '@/lib/valuation/ports';
import type { EnrichResult } from '@/lib/valuation/types';

/** Builder di un body §9 valido (worked example, lat/lng dentro ZONE_A). */
export function makeRequestInput(
  overrides: Record<string, unknown> = {},
): ValuationRequestInput {
  return ValuationRequestSchema.parse({
    nome: 'Mario',
    cognome: 'Rossi',
    email: 'mario.rossi@example.it',
    telefono: '3331234567',
    consent_privacy: true,
    intent: 'vendere_ora',
    address_raw: 'Via Roma 1, Milano',
    lat: 45.467,
    lng: 9.19,
    property_type: 'appartamento',
    superficie_mq: 85,
    stanze: 3,
    ascensore: true,
    condizioni: 'ristrutturata',
    anni_ristrutturazione: '<5',
    piano: 3,
    piani_edificio: 6,
    classe_energetica: 'A',
    ...overrides,
  });
}

export class FakeValuationPersistence implements ValuationPersistence {
  public leads: LeadInput[] = [];
  public requests: RequestPersistInput[] = [];
  public updates: { referenceId: string; result: EnrichResult }[] = [];

  constructor(private readonly opts: { created?: boolean; existingReferenceId?: string } = {}) {}

  async createLeadAndRequest(lead: LeadInput, request: RequestPersistInput): Promise<PersistResult> {
    const created = this.opts.created ?? true;
    this.leads.push(lead);
    this.requests.push(request);
    return {
      referenceId: created ? request.reference_id : (this.opts.existingReferenceId ?? request.reference_id),
      created,
    };
  }

  async updateEnrichment(referenceId: string, result: EnrichResult): Promise<void> {
    this.updates.push({ referenceId, result });
  }
}

export class RecordingEmailSender implements EmailSender {
  public sent: EmailMessage[] = [];
  constructor(private readonly shouldThrow = false) {}
  async send(message: EmailMessage): Promise<void> {
    if (this.shouldThrow) throw new Error('email down');
    this.sent.push(message);
  }
}

export class ThrowingOmiResolver implements OmiResolver {
  async resolve(): Promise<never> {
    throw new Error('omi resolver down');
  }
}
