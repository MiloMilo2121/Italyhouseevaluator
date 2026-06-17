import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { getServerEnv } from '@/lib/env';
import { renderValuationReport } from '@/lib/report/valuation-report';
import { flattenDetailRow, rowToEnrichResult, rowToReportData, type DetailDbRow } from '@/lib/agenti/card';
import FinalizeForm from './FinalizeForm';
import NarrateButton from './NarrateButton';
import PeriziaButton from './PeriziaButton';
import DocumentsPanel, { type DocItem } from './DocumentsPanel';

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
  const canNarrate = rowToEnrichResult(row) != null;

  const documentiEnabled = getServerEnv().DOCUMENTI_ENABLED;
  let documents: DocItem[] = [];
  if (documentiEnabled) {
    const { data: docsData } = await supabase
      .from('valuation_documents')
      .select('id, kind, status, mime, transcript, error')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: true });
    documents = (docsData ?? []) as DocItem[];
  }

  return (
    <div>
      <p>
        <Link href="/agenti">← Torna alla lista</Link>
      </p>
      {canNarrate && <NarrateButton referenceId={row.reference_id} hasNarrative={row.narrative != null} />}
      {canNarrate && <PeriziaButton referenceId={row.reference_id} hasPerizia={row.perizia != null} />}
      {/* Report deterministico (numeri del motore) + narrazione interleavata se presente */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {documentiEnabled && (
        <DocumentsPanel
          referenceId={row.reference_id}
          documents={documents}
          documentiStatus={row.documenti_status}
        />
      )}
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
