import type { OmiResolver } from '@/lib/valuation/ports';
import type { GeoPoint, OmiResolution } from '@/lib/valuation/types';
import type { ZoneFixture } from './omi-zones.fixture';

/**
 * Fake resolver per i test: point-in-polygon via ray-casting in TS puro (niente
 * PostGIS, niente DB). Possiede la fallback ladder come il resolver reale (M3):
 * dentro una zona con dati → 'none'; dentro una zona senza righe → 'prior_only';
 * fuori da tutto → comportamento `outside` configurabile (per esercitare
 * nearest / comune / prior_only).
 *
 * NOTA: ST_Contains di PostGIS ha semantica diversa ai bordi/multipolygon/buchi.
 * Questi test validano la logica A VALLE del resolver, non il resolver spaziale,
 * che va testato su geometrie reali in M3.
 */

export function pointInRing(point: GeoPoint, ring: [number, number][]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const xi = pi[0];
    const yi = pi[1];
    const xj = pj[0];
    const yj = pj[1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const PRIOR_ONLY_OUTSIDE: OmiResolution = {
  zonaOmiId: null,
  fallbackLevel: 'prior_only',
  rows: [],
  semestre: null,
};

export class FakeOmiResolver implements OmiResolver {
  constructor(
    private readonly zones: ZoneFixture[],
    private readonly outside: OmiResolution = PRIOR_ONLY_OUTSIDE,
  ) {}

  async resolve(point: GeoPoint): Promise<OmiResolution> {
    for (const z of this.zones) {
      if (pointInRing(point, z.ring)) {
        if (z.rows.length === 0) {
          return { zonaOmiId: z.id, fallbackLevel: 'prior_only', rows: [], semestre: null };
        }
        return {
          zonaOmiId: z.id,
          fallbackLevel: 'none',
          rows: z.rows,
          semestre: z.rows[0]!.semestre,
        };
      }
    }
    return this.outside;
  }
}
