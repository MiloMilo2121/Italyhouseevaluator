import type { GeoJsonMultiPolygon, IngestionFlag } from './types';

/**
 * Sanificazione delle geometrie OMI (pura). Gestisce i bug noti documentati:
 * - geometrie mal-georeferenziate (es. un poligono sardo posizionato in Africa
 *   che rompe il bounding box) → fuori dal bbox Italia ⇒ scartate e segnalate;
 * - ring invalidi (troppo pochi punti / non chiusi) ⇒ segnalati.
 * Si scarta/segnala invece di crashare.
 */

export const ITALY_BBOX = { minLng: 6.0, minLat: 35.0, maxLng: 19.0, maxLat: 47.6 };

export function isPointInItaly(point: [number, number]): boolean {
  const [lng, lat] = point;
  return (
    lng >= ITALY_BBOX.minLng &&
    lng <= ITALY_BBOX.maxLng &&
    lat >= ITALY_BBOX.minLat &&
    lat <= ITALY_BBOX.maxLat
  );
}

export function ringCentroid(ring: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  const n = ring.length || 1;
  return [sx / n, sy / n];
}

/** Un ring valido ha ≥4 vertici ed è chiuso (primo == ultimo). */
export function isValidRing(ring: [number, number][]): boolean {
  if (ring.length < 4) return false;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1];
}

/** Chiude un ring se non lo è già (≥3 vertici). */
export function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

export interface SanitizeResult {
  rings: [number, number][][] | null;
  flags: IngestionFlag[];
}

/**
 * Sanifica i ring di una zona: chiude i ring aperti, scarta quelli con troppi
 * pochi vertici, e scarta l'intera geometria se il suo centroide cade fuori dal
 * bounding box dell'Italia (bug del poligono in Africa).
 */
export function sanitizeZoneRings(linkZona: string, rawRings: [number, number][][]): SanitizeResult {
  const flags: IngestionFlag[] = [];
  const valid: [number, number][][] = [];

  for (const raw of rawRings) {
    const ring = closeRing(raw);
    if (!isValidRing(ring)) {
      flags.push({ kind: 'geometry_invalid_ring', linkZona, detail: `ring con ${raw.length} vertici scartato` });
      continue;
    }
    valid.push(ring);
  }

  if (valid.length === 0) {
    return { rings: null, flags };
  }

  // Controllo bbox Italia sul centroide del primo ring (anti-Africa).
  const centroid = ringCentroid(valid[0]!);
  if (!isPointInItaly(centroid)) {
    flags.push({
      kind: 'geometry_outside_italy',
      linkZona,
      detail: `centroide (${centroid[0].toFixed(3)}, ${centroid[1].toFixed(3)}) fuori dall'Italia`,
    });
    return { rings: null, flags };
  }

  return { rings: valid, flags };
}

/** Converte i ring sanificati in un GeoJSON MultiPolygon (un poligono per ring). */
export function ringsToMultiPolygon(rings: [number, number][][]): GeoJsonMultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: rings.map((ring) => [ring]),
  };
}
