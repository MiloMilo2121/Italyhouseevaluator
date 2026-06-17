import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { renderValuationReport } from '@/lib/report/valuation-report';
import { flattenDetailRow, rowToReportData, type DetailDbRow } from '@/lib/agenti/card';
import FinalizeForm from './FinalizeForm';

export const dynamic = 'force-dynamic';

export default async function DetailPage({ params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('valuation_requests')
    .select('*, leads(nome, cognome, email, telefono, intent, is_priority)')
    .eq('reference_id', referenceId)
    .single();

  if (error || !data) notFound();

  const row = flattenDetailRow(data as unknown as DetailDbRow);
  const html = renderValuationReport(rowToReportData(row)).html;
  const initialValue = row.agent_final_value != null ? Number(row.agent_final_value) : null;

  return (
    <div>
      <p>
        <Link href="/agenti">← Torna alla lista</Link>
      </p>
      {/* Stessa scheda dell'email agente (DRY) */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <hr style={{ margin: '24px 0' }} />
      <h3>Chiudi la valutazione (valore finale reale)</h3>
      <p style={{ color: '#666', fontSize: 13 }}>
        Questo chiude il flywheel: il valore reale viene salvato per ricalibrare il modello.
      </p>
      <FinalizeForm
        referenceId={row.reference_id}
        initialValue={initialValue}
        initialNotes={row.agent_notes ?? ''}
        status={row.valuation_status}
      />
    </div>
  );
}
