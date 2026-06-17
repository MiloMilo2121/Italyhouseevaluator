import { GooglePlacesProvider } from './google-places';
import { MockGeocodingProvider } from './mock';
import { NominatimProvider } from './nominatim';
import type { GeocodingProvider } from './types';

/**
 * Seleziona il provider di geocoding in base alla config. Fallback al Mock
 * quando manca la chiave (così dev/test/build girano keyless). Env iniettato
 * (non legge getServerEnv) ⇒ testabile e disaccoppiato.
 */

export interface GeocodingFactoryOptions {
  provider?: 'google' | 'nominatim';
  googleKey?: string | undefined;
  fetchImpl?: typeof fetch;
}

export function createGeocodingProvider(opts: GeocodingFactoryOptions = {}): GeocodingProvider {
  const provider = opts.provider ?? 'google';
  if (provider === 'google' && opts.googleKey) {
    return new GooglePlacesProvider(opts.googleKey, opts.fetchImpl ?? fetch);
  }
  if (provider === 'nominatim') {
    return new NominatimProvider(opts.fetchImpl ?? fetch);
  }
  return new MockGeocodingProvider();
}
