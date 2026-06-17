import Link from 'next/link';
import type { CSSProperties } from 'react';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { sortRequests, toListItem, type AgentListRow } from '@/lib/agenti/list';
import type { Intent } from '@/lib/valuation/types';

export const dynamic = 'force-dynamic';

interface RawLead {
  nome: string;
  cognome: string;
  intent: Intent;
  is_priority: boolean;
}
interface RawRow {
  reference_id: string;
  comune: string | null;
  estimate_min: number | null;
  estimate_max: number | null;
  confidence_label: string | null;
  valuation_status: string;
  created_at: string;
  leads: RawLead | RawLead[] | null;
}

const th: CSSProperties = { textAlign: 'left', padding: 8, borderBottom: '2px solid #eee', fontSize: 13 };
const td: CSSProperties = { padding: 8, borderBottom: '1px solid #f2f2f2' };

export default async function AgentiListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('valuation_requests')
    .select(
      'reference_id, comune, estimate_min, estimate_max, confidence_label, valuation_status, created_at, leads(nome, cognome, intent, is_priority)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return <p style={{ color: '#c92a2a' }}>Errore nel caricamento: {error.message}</p>;

  const raw = (data ?? []) as unknown as RawRow[];
  const rows: AgentListRow[] = raw.map((r) => {
    const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads;
    return {
      reference_id: r.reference_id,
      comune: r.comune,
      estimate_min: r.estimate_min,
      estimate_max: r.estimate_max,
      confidence_label: r.confidence_label,
      valuation_status: r.valuation_status,
      created_at: r.created_at,
      nome: lead?.nome ?? '',
      cognome: lead?.cognome ?? '',
      intent: lead?.intent ?? 'vendere_dopo',
      is_priority: lead?.is_priority ?? false,
    };
  });
  const items = sortRequests(rows).map(toListItem);

  return (
    <div>
      <h1>Lead &amp; valutazioni</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['', 'Nominativo', 'Intento', 'Comune', 'Stima', 'Confidenza', 'Stato', 'Data'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.referenceId}>
              <td style={td}>{it.isPriority ? '🔥' : ''}</td>
              <td style={td}>
                <Link href={`/agenti/${it.referenceId}`}>{it.nominativo || it.referenceId}</Link>
              </td>
              <td style={td}>{it.intentLabel}</td>
              <td style={td}>{it.comune}</td>
              <td style={td}>{it.stima}</td>
              <td style={td}>{it.confidence}</td>
              <td style={td}>{it.status}</td>
              <td style={td}>{it.data}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p style={{ color: '#888' }}>Nessuna richiesta ancora.</p>}
    </div>
  );
}
