import { NextResponse } from 'next/server';
import { createGeocodingProvider } from '@/lib/geocoding/factory';

/**
 * Proxy di geocoding (§3, §12). Il funnel chiama questa route; la chiave Google
 * resta server-side. Legge solo le due env di geocoding (non l'intero server
 * env) così funziona anche senza Supabase configurato, degradando al Mock.
 *   GET ?q=<query>&token=<session>   → { suggestions }
 *   GET ?placeId=<id>&token=<session> → { place }
 */
export const runtime = 'nodejs';

function provider() {
  return createGeocodingProvider({
    provider: (process.env['GEOCODING_PROVIDER'] as 'google' | 'nominatim' | undefined) ?? 'google',
    googleKey: process.env['GOOGLE_PLACES_API_KEY'],
  });
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') ?? undefined;
  const placeId = searchParams.get('placeId');
  const q = searchParams.get('q');

  try {
    const geo = provider();
    if (placeId) {
      const place = await geo.resolve(placeId, token ? { sessionToken: token } : undefined);
      return NextResponse.json({ place });
    }
    if (q && q.trim().length >= 3) {
      const suggestions = await geo.autocomplete(q, token ? { sessionToken: token } : undefined);
      return NextResponse.json({ suggestions });
    }
    return NextResponse.json({ suggestions: [] });
  } catch (err) {
    console.error('[geocoding] errore:', err);
    return NextResponse.json({ error: 'Geocoding non disponibile' }, { status: 502 });
  }
}
