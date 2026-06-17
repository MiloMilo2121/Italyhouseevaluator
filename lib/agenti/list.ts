import type { Intent } from '@/lib/valuation/types';

/**
 * Vista lista della dashboard (§11), PURA. Ordina per priorità intent (gli
 * intenti "ora" in cima) poi per data desc, e mappa la riga in un view-model.
 */

export interface AgentListRow {
  reference_id: string;
  comune: string | null;
  estimate_min: number | null;
  estimate_max: number | null;
  confidence_label: string | null;
  valuation_status: string;
  created_at: string;
  is_priority: boolean;
  intent: Intent;
  nome: string;
  cognome: string;
}

export interface AgentListItem {
  referenceId: string;
  nominativo: string;
  intentLabel: string;
  isPriority: boolean;
  comune: string;
  stima: string;
  confidence: string;
  status: string;
  data: string;
}

const INTENT_LABEL: Record<Intent, string> = {
  vendere_ora: 'Vendere ora',
  vendere_dopo: 'Vendere',
  comprare_ora: 'Comprare ora',
  comprare_dopo: 'Comprare',
};

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function sortRequests(rows: AgentListRow[]): AgentListRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;
    return b.created_at.localeCompare(a.created_at); // data desc
  });
}

export function toListItem(row: AgentListRow): AgentListItem {
  const stima =
    row.estimate_min != null && row.estimate_max != null
      ? `${eur.format(row.estimate_min)} – ${eur.format(row.estimate_max)}`
      : '—';
  return {
    referenceId: row.reference_id,
    nominativo: `${row.nome} ${row.cognome}`.trim(),
    intentLabel: INTENT_LABEL[row.intent],
    isPriority: row.is_priority,
    comune: row.comune ?? '—',
    stima,
    confidence: row.confidence_label ?? '—',
    status: row.valuation_status,
    data: row.created_at.slice(0, 10),
  };
}
