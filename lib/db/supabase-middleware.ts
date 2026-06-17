import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicSupabaseEnv } from './supabase-env';

/**
 * Refresh della sessione + protezione di /agenti (@supabase/ssr). REGOLA: niente
 * codice tra createServerClient e getClaims(), o le sessioni si rompono a caso.
 * getClaims() verifica il JWT localmente (asymmetric keys) con fallback di rete.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = publicSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthed = data?.claims != null;

  const { pathname } = request.nextUrl;
  if (!isAuthed && pathname.startsWith('/agenti') && !pathname.startsWith('/agenti/login')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/agenti/login';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
