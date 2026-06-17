import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseEnv } from './supabase-env';

/**
 * Client Supabase server-side legato ai cookie di sessione (@supabase/ssr).
 * Usa l'anon key + la sessione utente ⇒ le query rispettano la RLS (M6). Da
 * usare nei Server Component e nei route handler autenticati.
 */
export async function createServerSupabase() {
  const { url, anonKey } = publicSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie li aggiorna il middleware.
        }
      },
    },
  });
}
