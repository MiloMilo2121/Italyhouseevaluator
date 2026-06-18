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
  /** Poligoni sanificati (coordinate GeoJSON MultiPolygon) o null se nessuno valido. */
  polygons: [number, number][][][] | null;
  flags: IngestionFlag[];
}

/**
 * Sanifica i poligoni di una zona RISPETTANDO I FORI: per ogni poligono chiude e
 * valida l'anello esterno (scarta il poligono se invalido) e i fori (scarta solo
 * il foro invalido, non il poligono). Scarta l'intera geometria se il centroide
 * del primo esterno cade fuori dal bbox Italia (bug del poligono in Africa).
 */
export function sanitizeZonePolygons(
  linkZona: string,
  rawPolygons: [number, number][][][],
): SanitizeResult {
  const flags: IngestionFlag[] = [];
  const valid: [number, number][][][] = [];

  for (const poly of rawPolygons) {
    const [rawOuter, ...rawHoles] = poly;
    if (rawOuter == null) continue;
    const outer = closeRing(rawOuter);
    if (!isValidRing(outer)) {
      flags.push({ kind: 'geometry_invalid_ring', linkZona, detail: `esterno con ${rawOuter.length} vertici scartato` });
      continue;
    }
    const rings: [number, number][][] = [outer];
    for (const rawHole of rawHoles) {
      const hole = closeRing(rawHole);
      if (isValidRing(hole)) rings.push(hole);
      else flags.push({ kind: 'geometry_invalid_ring', linkZona, detail: `foro con ${rawHole.length} vertici scartato` });
    }
    valid.push(rings);
  }

  if (valid.length === 0) {
    return { polygons: null, flags };
  }

  // Controllo bbox Italia sul centroide del primo esterno (anti-Africa).
  const centroid = ringCentroid(valid[0]![0]!);
  if (!isPointInItaly(centroid)) {
    flags.push({
      kind: 'geometry_outside_italy',
      linkZona,
      detail: `centroide (${centroid[0].toFixed(3)}, ${centroid[1].toFixed(3)}) fuori dall'Italia`,
    });
    return { polygons: null, flags };
  }

  return { polygons: valid, flags };
}

/** Converte i poligoni sanificati (esterno + fori) in un GeoJSON MultiPolygon. */
export function polygonsToMultiPolygon(polygons: [number, number][][][]): GeoJsonMultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}
