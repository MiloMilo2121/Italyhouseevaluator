import { describe, it, expect } from 'vitest';
import { MockGeocodingProvider } from '@/lib/geocoding/mock';
import { GooglePlacesProvider } from '@/lib/geocoding/google-places';
import { createGeocodingProvider } from '@/lib/geocoding/factory';

describe('geocoding mock + factory', () => {
  it('MockGeocodingProvider: autocomplete (≥3 char) e resolve', async () => {
    const m = new MockGeocodingProvider();
    expect(await m.autocomplete('vi')).toHaveLength(0);
    expect((await m.autocomplete('via')).length).toBeGreaterThan(0);
    expect((await m.resolve('mock-1')).lat).toBe(45.4642);
  });

  it('factory: senza chiave ⇒ Mock (dev/test/build keyless)', () => {
    expect(createGeocodingProvider({})).toBeInstanceOf(MockGeocodingProvider);
    expect(createGeocodingProvider({ provider: 'google' })).toBeInstanceOf(MockGeocodingProvider);
  });

  it('factory: google + chiave ⇒ GooglePlacesProvider con headers/mapping corretti', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('autocomplete')) {
        return new Response(
          JSON.stringify({
            suggestions: [
              {
                placePrediction: {
                  placeId: 'p1',
                  text: { text: 'Via Roma 1' },
                  structuredFormat: { secondaryText: { text: 'Milano' } },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          formattedAddress: 'Via Roma 1, Milano',
          location: { latitude: 45.46, longitude: 9.19 },
          addressComponents: [
            { types: ['locality'], longText: 'Milano' },
            { types: ['postal_code'], longText: '20121' },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const g = createGeocodingProvider({ provider: 'google', googleKey: 'KEY', fetchImpl: fakeFetch });
    expect(g).toBeInstanceOf(GooglePlacesProvider);

    const sugg = await g.autocomplete('via roma', { sessionToken: 'tok' });
    expect(sugg[0]!.id).toBe('p1');
    expect(sugg[0]!.label).toBe('Via Roma 1');
    expect(calls[0]!.url).toContain('places:autocomplete');
    expect((calls[0]!.init!.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY');

    const place = await g.resolve('p1', { sessionToken: 'tok' });
    expect(place.lat).toBe(45.46);
    expect(place.comune).toBe('Milano');
    expect(place.cap).toBe('20121');
    expect(calls[1]!.url).toContain('/v1/places/p1');
  });
});
