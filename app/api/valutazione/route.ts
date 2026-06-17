import { NextResponse } from 'next/server';
import { ValuationRequestSchema } from '@/lib/schemas/valuation-request.schema';
import { handleValuation } from '@/lib/api/handle-valuation';
import { createServiceClient } from '@/lib/db/client';
import { SupabaseValuationPersistence } from '@/lib/db/valuations';
import { loadActiveCoefficientSet } from '@/lib/db/coefficient-sets';
import { SupabaseOmiQueryClient, type SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { OmiResolverImpl } from '@/lib/omi/resolver';
import { emptyComparablesProvider } from '@/lib/valuation/comparables-empty';
import { SupabaseComparablesProvider } from '@/lib/valuation/comparables-supabase';
import { createEmailSender } from '@/lib/email/resend';
import { getServerEnv } from '@/lib/env';

/**
 * POST /api/valutazione (§9). Pipeline sincrona: Zod validate → insert lead+request
 * COMMITTED → enrich best-effort → update → email → 200 { reference_id }.
 * Errori di enrich/email NON propagano (gestiti in handleValuation): mai 5xx per
 * loro. Solo un fallimento del core (DB) produce 500.
 */
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const parsed = ValuationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validazione fallita', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const env = getServerEnv();
    const client = createServiceClient();
    const rpcClient = client as unknown as SupabaseRpcClient;
    // V2: comparabili MCA dietro flag (default off ⇒ stima su base OMI).
    const comparablesProvider =
      process.env['COMPS_ENABLED'] === 'true'
        ? new SupabaseComparablesProvider(rpcClient)
        : emptyComparablesProvider;
    const result = await handleValuation(parsed.data, {
      persistence: new SupabaseValuationPersistence(client),
      loadCoefficientSet: () => loadActiveCoefficientSet(client),
      omiResolver: new OmiResolverImpl(new SupabaseOmiQueryClient(rpcClient)),
      comparablesProvider,
      emailSender: createEmailSender(),
      modelVersion: env.VALUATION_MODEL_VERSION,
      agentEmail: env.AGENT_NOTIFICATION_EMAIL ?? 'agenti@example.it',
    });
    return NextResponse.json({ reference_id: result.referenceId }, { status: 200 });
  } catch (err) {
    // Fallimento del core (es. DB non raggiungibile): il lead non è stato salvato.
    console.error('[valutazione] errore core:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
