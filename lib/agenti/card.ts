import type { AgentCardData } from '@/lib/email/templates';
import type { ValuationReportData } from '@/lib/report/valuation-report';
import type { ValuationNarrative } from '@/lib/narration/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';
import type {
  ComparableContribution,
  ConfidenceLabel,
  EnrichResult,
  FallbackLevel,
  Intent,
} from '@/lib/valuation/types';

/**
 * Adatta una riga di valuation_requests (+ lead) nei dati per `renderAgentCard`
 * (riuso DRY della scheda email nel dettaglio dashboard) e ricostruisce
 * l'EnrichResult dai campi intelligence. Puro.
 */

export interface DetailLead {
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  intent: Intent;
  is_priority: boolean;
}

export interface DetailRow {
  reference_id: string;
  property_type: string;
  superficie_mq: number | string;
  stanze: number | null;
  piano: number | null;
  piani_edificio: number | null;
  ascensore: boolean;
  condizioni: string;
  classe_energetica: string | null;
  has_balcone: boolean;
  has_garage: boolean;
  has_giardino: boolean;
  address_raw: string;
  address_normalized: string | null;
  comune: string | null;
  cap: string | null;
  lat: number | null;
  lng: number | null;
  superficie_commerciale_mq: number | string | null;
  zona_omi_id: string | null;
  fallback_level: string;
  omi_eur_mq_min: number | string | null;
  omi_eur_mq_max: number | string | null;
  coefficients_applied: Record<string, number> | null;
  estimate_min: number | string | null;
  estimate_max: number | string | null;
  confidence_score: number | null;
  confidence_label: string | null;
  confidence_fsd: number | string | null;
  breakdown: { label: string; contributo: number }[] | null;
  comparables: ComparableContribution[] | null;
  narrative: ValuationNarrative | null;
  catasto: CatastoData | null;
  document_facts: DocumentFacts | null;
  documenti_status: string | null;
  agent_final_value: number | string | null;
  agent_notes: string | null;
  valuation_status: string;
  lead: DetailLead;
}

export interface DetailDbRow extends Omit<DetailRow, 'lead'> {
  leads: DetailLead | DetailLead[] | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const EMPTY_LEAD: DetailLead = {
  nome: '',
  cognome: '',
  email: '',
  telefono: null,
  intent: 'vendere_dopo',
  is_priority: false,
};

export function flattenDetailRow(db: DetailDbRow): DetailRow {
  const lead = Array.isArray(db.leads) ? db.leads[0] : db.leads;
  return { ...db, lead: lead ?? EMPTY_LEAD } as DetailRow;
}

export function rowToEnrichResult(row: DetailRow): EnrichResult | null {
  const surface = num(row.superficie_commerciale_mq);
  if (surface == null) return null;
  return {
    superficie_commerciale_mq: surface,
    zona_omi_id: row.zona_omi_id,
    fallback_level: row.fallback_level as FallbackLevel,
    omi_eur_mq_min: num(row.omi_eur_mq_min),
    omi_eur_mq_max: num(row.omi_eur_mq_max),
    coefficients_applied: row.coefficients_applied ?? {},
    estimate_min: num(row.estimate_min),
    estimate_max: num(row.estimate_max),
    confidence: {
      score: row.confidence_score ?? 0,
      label: (row.confidence_label as ConfidenceLabel) ?? 'Bassa',
      fsd: num(row.confidence_fsd) ?? 0,
    },
    breakdown: row.breakdown ?? [],
    comparables: row.comparables ?? [],
  };
}

/** Dati per il report di valutazione (dashboard). Costruisce un EnrichResult
 * "non disponibile" quando la richiesta non è ancora arricchita. */
export function rowToReportData(row: DetailRow): ValuationReportData {
  const enrich: EnrichResult = rowToEnrichResult(row) ?? {
    superficie_commerciale_mq: num(row.superficie_commerciale_mq) ?? 0,
    zona_omi_id: row.zona_omi_id,
    fallback_level: (row.fallback_level as FallbackLevel) ?? 'prior_only',
    omi_eur_mq_min: null,
    omi_eur_mq_max: null,
    coefficients_applied: {},
    estimate_min: null,
    estimate_max: null,
    confidence: { score: 0, label: 'Bassa', fsd: 0 },
    breakdown: [],
    comparables: [],
  };
  return {
    referenceId: row.reference_id,
    address: {
      normalized: row.address_normalized,
      raw: row.address_raw,
      comune: row.comune,
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
    },
    enrich,
    narrative: row.narrative,
    catasto: row.catasto,
    documentFacts: row.document_facts,
  };
}

export function rowToAgentCardData(row: DetailRow): AgentCardData {
  return {
    referenceId: row.reference_id,
    lead: {
      nome: row.lead.nome,
      cognome: row.lead.cognome,
      email: row.lead.email,
      telefono: row.lead.telefono ?? '',
      intent: row.lead.intent,
      isPriority: row.lead.is_priority,
    },
    property: {
      propertyType: row.property_type,
      superficieMq: num(row.superficie_mq) ?? 0,
      stanze: row.stanze ?? 0,
      piano: row.piano ?? 0,
      pianiEdificio: row.piani_edificio ?? 0,
      ascensore: row.ascensore,
      condizioni: row.condizioni,
      classeEnergetica: row.classe_energetica,
      hasBalcone: row.has_balcone,
      hasGarage: row.has_garage,
      hasGiardino: row.has_giardino,
    },
    address: {
      raw: row.address_raw,
      normalized: row.address_normalized,
      comune: row.comune,
      cap: row.cap,
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
    },
    enrich: rowToEnrichResult(row),
    dashboardUrl: `/agenti/${row.reference_id}`,
  };
}
