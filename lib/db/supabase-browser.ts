import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseEnv } from './supabase-env';

/** Client Supabase lato browser (per il form di login agente). */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
