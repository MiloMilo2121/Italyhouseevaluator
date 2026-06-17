/**
 * Config public di Supabase letta direttamente da process.env (inlined da Next
 * lato client; reale lato server/edge). Evita di parsare l'intero process.env
 * nel browser (dove l'oggetto non è popolato come sul server).
 */
export function publicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Config Supabase mancante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return { url, anonKey };
}
