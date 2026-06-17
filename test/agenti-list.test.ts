import { describe, it, expect } from 'vitest';
import { sortRequests, toListItem, type AgentListRow } from '@/lib/agenti/list';

function row(over: Partial<AgentListRow>): AgentListRow {
  return {
    reference_id: 'VAL-X',
    comune: 'Milano',
    estimate_min: 300000,
    estimate_max: 340000,
    confidence_label: 'Alta',
    valuation_status: 'enriched',
    created_at: '2026-06-01T10:00:00Z',
    is_priority: false,
    intent: 'vendere_dopo',
    nome: 'Mario',
    cognome: 'Rossi',
    ...over,
  };
}

describe('lista dashboard (§11)', () => {
  it('ordina: priorità prima, poi data desc', () => {
    const rows = [
      row({ reference_id: 'A', is_priority: false, created_at: '2026-06-01T00:00:00Z' }),
      row({ reference_id: 'B', is_priority: true, created_at: '2026-05-01T00:00:00Z' }),
      row({ reference_id: 'C', is_priority: false, created_at: '2026-06-10T00:00:00Z' }),
    ];
    expect(sortRequests(rows).map((r) => r.reference_id)).toEqual(['B', 'C', 'A']);
  });

  it('toListItem: nominativo, intento, stima formattata, data', () => {
    const it0 = toListItem(row({ intent: 'vendere_ora', is_priority: true }));
    expect(it0.nominativo).toBe('Mario Rossi');
    expect(it0.intentLabel).toBe('Vendere ora');
    expect(it0.isPriority).toBe(true);
    expect(it0.stima).toContain('300.000');
    expect(it0.data).toBe('2026-06-01');

    expect(toListItem(row({ estimate_min: null, estimate_max: null })).stima).toBe('—');
  });
});
