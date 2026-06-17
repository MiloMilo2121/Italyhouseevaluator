import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { flattenDetailRow, rowToEnrichResult, type DetailDbRow } from '@/lib/agenti/card';
import { renderPerizia, type PeriziaReportData } from '@/lib/perizia/render';
import type { EnrichResult, FallbackLevel } from '@/lib/valuation/types';

/** Pagina perizia pronta-stampa (V2 Step 4). Authed, force-dynamic. */
export const dynamic = 'force-dynamic';

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function PeriziaPage({ params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('valuation_requests')
    .select('*')
    .eq('reference_id', referenceId)
    .single();
  if (error || !data) notFound();

  const row = flattenDetailRow(data as unknown as DetailDbRow);
  const enrich: EnrichResult =
    rowToEnrichResult(row) ?? {
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

  const reportData: PeriziaReportData = {
    referenceId: row.reference_id,
    address: {
      normalized: row.address_normalized,
      raw: row.address_raw,
      comune: row.comune,
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
    },
    propertyType: row.property_type,
    superficieDichiarataMq: num(row.superficie_mq),
    enrich,
    catasto: row.catasto,
    documentFacts: row.document_facts,
    perizia: row.perizia,
  };

  const html = renderPerizia(reportData).html;

  return (
    <div>
      <p>
        <Link href={`/agenti/${referenceId}`}>← Torna alla scheda</Link>
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
