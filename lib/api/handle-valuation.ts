import {
  toLeadInput,
  toSubjectProperty,
  type LeadInput,
  type ValuationRequestInput,
} from '@/lib/schemas/valuation-request.schema';
import { enrich } from '@/lib/valuation/enrich';
import { computeInputHash, referenceIdFromHash } from '@/lib/valuation/hash';
import type { CoefficientSet, EnrichResult } from '@/lib/valuation/types';
import type { ComparablesProvider, OmiResolver } from '@/lib/valuation/ports';
import { renderAgentCard, renderLeadConfirmation, type AgentCardData } from '@/lib/email/templates';
import type { EmailSender, RequestPersistInput, ValuationPersistence } from './ports';

/**
 * Orchestratore della richiesta di valutazione (§4, §9). Dipendenze iniettate
 * ⇒ testabile con fake (zero DB/Resend). Garanzie:
 *  - lead + request COMMITTED prima dell'enrichment (source-of-truth);
 *  - enrich ed email sono best-effort: un loro fallimento NON propaga (mai 5xx),
 *    il lead resta salvato;
 *  - idempotenza: re-submit (created=false) salta enrich/email.
 */

export interface HandleValuationDeps {
  persistence: ValuationPersistence;
  loadCoefficientSet: () => Promise<CoefficientSet>;
  omiResolver: OmiResolver;
  comparablesProvider: ComparablesProvider;
  emailSender: EmailSender;
  modelVersion: number;
  agentEmail: string;
  dashboardBaseUrl?: string;
}

export async function handleValuation(
  input: ValuationRequestInput,
  deps: HandleValuationDeps,
): Promise<{ referenceId: string }> {
  const subject = toSubjectProperty(input);
  const lead = toLeadInput(input);

  // --- CORE (DB): coeff set attivo + persistenza committed PRIMA dell'enrich ---
  const cs = await deps.loadCoefficientSet();
  const inputHash = computeInputHash(subject, {
    leadEmail: lead.email,
    coefficientSetId: cs.id,
    coefficientSetVersion: cs.version,
    modelVersion: deps.modelVersion,
  });
  const referenceId = referenceIdFromHash(inputHash);

  const { referenceId: refId, created } = await deps.persistence.createLeadAndRequest(
    lead,
    buildRequestPersistInput(input, referenceId, inputHash, cs.id, deps.modelVersion),
  );

  // Re-submit idempotente: già enriched + email inviate.
  if (!created) return { referenceId: refId };

  // --- ENRICHMENT (best-effort) ---
  let enrichResult: EnrichResult | null = null;
  try {
    enrichResult = await enrich(subject, {
      coefficientSet: cs,
      omiResolver: deps.omiResolver,
      comparablesProvider: deps.comparablesProvider,
    });
    await deps.persistence.updateEnrichment(refId, enrichResult);
  } catch (err) {
    console.error('[valutazione] enrichment fallito (lead salvato):', err);
  }

  // --- EMAIL (best-effort, per-messaggio) ---
  await sendEmails(input, lead, enrichResult, refId, deps);

  return { referenceId: refId };
}

function buildRequestPersistInput(
  input: ValuationRequestInput,
  referenceId: string,
  inputHash: string,
  coefficientSetId: string,
  modelVersion: number,
): RequestPersistInput {
  return {
    reference_id: referenceId,
    input_hash: inputHash,
    coefficient_set_id: coefficientSetId,
    model_version: modelVersion,
    property_type: input.property_type,
    superficie_mq: input.superficie_mq,
    stanze: input.stanze,
    ascensore: input.ascensore,
    has_balcone: input.dotazioni.balcone,
    has_garage: input.dotazioni.garage,
    has_giardino: input.dotazioni.giardino,
    condizioni: input.condizioni,
    anni_ristrutturazione: input.anni_ristrutturazione ?? null,
    piano: input.piano,
    piano_label: input.piano_label ?? null,
    piani_edificio: input.piani_edificio,
    riscaldamento: input.riscaldamento ?? null,
    classe_energetica: input.classe_energetica ?? null,
    address_raw: input.address_raw,
    address_normalized: input.address_normalized ?? null,
    comune: input.comune ?? null,
    cap: input.cap ?? null,
    lat: input.lat,
    lng: input.lng,
  };
}

async function sendEmails(
  input: ValuationRequestInput,
  lead: LeadInput,
  enrichResult: EnrichResult | null,
  referenceId: string,
  deps: HandleValuationDeps,
): Promise<void> {
  const agentCard = renderAgentCard(buildAgentCardData(input, lead, enrichResult, referenceId, deps));
  await trySend(deps.emailSender, { to: deps.agentEmail, subject: agentCard.subject, html: agentCard.html });

  const confirm = renderLeadConfirmation({ referenceId, nome: lead.nome });
  await trySend(deps.emailSender, { to: lead.email, subject: confirm.subject, html: confirm.html });
}

async function trySend(
  sender: EmailSender,
  message: { to: string; subject: string; html: string },
): Promise<void> {
  try {
    await sender.send(message);
  } catch (err) {
    console.error(`[valutazione] invio email a ${message.to} fallito:`, err);
  }
}

function buildAgentCardData(
  input: ValuationRequestInput,
  lead: LeadInput,
  enrichResult: EnrichResult | null,
  referenceId: string,
  deps: HandleValuationDeps,
): AgentCardData {
  return {
    referenceId,
    lead: {
      nome: lead.nome,
      cognome: lead.cognome,
      email: lead.email,
      telefono: lead.telefono,
      intent: lead.intent,
      isPriority: lead.is_priority,
    },
    property: {
      propertyType: input.property_type,
      superficieMq: input.superficie_mq,
      stanze: input.stanze,
      piano: input.piano,
      pianiEdificio: input.piani_edificio,
      ascensore: input.ascensore,
      condizioni: input.condizioni,
      classeEnergetica: input.classe_energetica ?? null,
      hasBalcone: input.dotazioni.balcone,
      hasGarage: input.dotazioni.garage,
      hasGiardino: input.dotazioni.giardino,
    },
    address: {
      raw: input.address_raw,
      normalized: input.address_normalized ?? null,
      comune: input.comune ?? null,
      cap: input.cap ?? null,
      lat: input.lat,
      lng: input.lng,
    },
    enrich: enrichResult,
    dashboardUrl: `${deps.dashboardBaseUrl ?? ''}/agenti/${referenceId}`,
  };
}
