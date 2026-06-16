import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from '@/lib/env';

/**
 * Factory dei client Supabase. Stub di M1: definita ma usata dalla API route
 * a partire da M4 (insert lead/request, update enrichment). I tipi generati
 * (`supabase gen types typescript`) sostituiranno `any` da M3 in poi.
 */

export function createBrowserClient(): SupabaseClient {
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Client server-side con service-role key. Bypassa RLS — usare SOLO in route
 * handler / codice server, mai nel browser.
 */
export function createServiceClient(): SupabaseClient {
  const pub = getPublicEnv();
  const srv = getServerEnv();
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
