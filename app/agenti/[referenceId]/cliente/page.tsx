import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { renderValuationReport } from '@/lib/report/valuation-report';
import { flattenDetailRow, rowToReportData, type DetailDbRow } from '@/lib/agenti/card';

/**
 * Anteprima del report CLIENTE (variante sintetica), pagina pulita e
 * print-friendly: l'agente la rivede e può "Salva come PDF" dal browser, oppure
 * inviarla via email dal dettaglio. Autenticata (sotto /agenti, middleware).
 */
export const dynamic = 'force-dynamic';

export default async function ClienteReportPage({ params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('valuation_requests')
    .select('*, leads(nome, cognome, email, telefono, intent, is_priority)')
    .eq('reference_id', referenceId)
    .single();
  if (error || !data) notFound();

  const row = flattenDetailRow(data as unknown as DetailDbRow);
  const { html } = renderValuationReport(rowToReportData(row), 'client');

  return (
    <main style={{ background: '#eceae3', minHeight: '100vh', padding: '16px 0' }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
