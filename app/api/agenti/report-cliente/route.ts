import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/supabase-server';
import { renderValuationReport } from '@/lib/report/valuation-report';
import { createEmailSender } from '@/lib/email/resend';
import { flattenDetailRow, rowToReportData, type DetailDbRow } from '@/lib/agenti/card';

/**
 * Invia al CLIENTE il report sintetico via email (variante 'client', senza
 * diagnostica interna). Autenticato (agente). Usa il sender Resend, che degrada
 * a logging senza RESEND_API_KEY (così funziona anche in locale). Il report è
 * HTML self-contained generato dalla stessa funzione pura della dashboard.
 */
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims == null) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  let body: { reference_id?: unknown; email?: unknown };
  try {
    body = (await req.json()) as { reference_id?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }
  const referenceId = body.reference_id;
  if (typeof referenceId !== 'string') {
    return NextResponse.json({ error: 'reference_id mancante' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('valuation_requests')
    .select('*, leads(nome, cognome, email, telefono, intent, is_priority)')
    .eq('reference_id', referenceId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Valutazione non trovata' }, { status: 404 });
  }

  const row = flattenDetailRow(data as unknown as DetailDbRow);
  const to = (typeof body.email === 'string' && body.email.trim()) || row.lead.email;
  if (!to) {
    return NextResponse.json({ error: 'Email del cliente mancante' }, { status: 409 });
  }
  if (row.estimate_min == null) {
    return NextResponse.json({ error: 'Valutazione non ancora arricchita' }, { status: 409 });
  }

  const { html } = renderValuationReport(rowToReportData(row), 'client');
  const subject = `La tua valutazione immobiliare — Rif. ${row.reference_id}`;
  const intro =
    `<p style="font-family:Geist,system-ui,sans-serif;color:#33312c;font-size:15px;max-width:820px;margin:0 auto 12px;padding:0 16px">` +
    `Gentile ${row.lead.nome || 'Cliente'}, in allegato la valutazione del suo immobile. ` +
    `Per qualunque chiarimento ci contatti pure.</p>`;

  try {
    await createEmailSender().send({ to, subject, html: `${intro}${html}` });
  } catch (e) {
    console.error('[report-cliente] invio fallito', e);
    return NextResponse.json({ error: 'Invio email fallito' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to });
}
