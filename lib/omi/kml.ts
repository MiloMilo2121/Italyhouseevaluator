import type { ParsedGeometry } from './types';

/**
 * Estrazione delle geometrie zona dal KML OMI (pura, senza dipendenze DOM:
 * estrazione via regex, sufficiente per il tracciato OMI). La sanificazione
 * (bbox Italia, ring) è in geometry.ts; qui si estraggono solo i ring grezzi.
 *
 * Associazione LinkZona: si cerca prima <SimpleData name="LinkZona">…</SimpleData>
 * (ExtendedData OMI), poi in fallback <name>…</name>.
 */

const PLACEMARK_RE = /<Placemark\b[\s\S]*?<\/Placemark>/g;
const LINKZONA_SIMPLEDATA_RE = /<SimpleData\s+name="LinkZona">([\s\S]*?)<\/SimpleData>/i;
const NAME_RE = /<name>([\s\S]*?)<\/name>/i;
const COORDS_RE = /<coordinates>([\s\S]*?)<\/coordinates>/gi;

/** Parsa un blocco <coordinates> "lng,lat[,alt] lng,lat[,alt] …" in un ring. */
export function parseCoordinates(text: string): [number, number][] {
  const ring: [number, number][] = [];
  for (const tuple of text.trim().split(/\s+/)) {
    if (tuple === '') continue;
    const parts = tuple.split(',');
    if (parts.length < 2) continue;
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) ring.push([lng, lat]);
  }
  return ring;
}

function extractLinkZona(placemark: string): string | null {
  const sd = placemark.match(LINKZONA_SIMPLEDATA_RE);
  if (sd?.[1]) return sd[1].trim();
  const nm = placemark.match(NAME_RE);
  if (nm?.[1]) return nm[1].trim();
  return null;
}

export interface KmlParseResult {
  geometries: ParsedGeometry[];
  /** Placemark senza LinkZona riconoscibile. */
  unlabeledPlacemarks: number;
}

export function parseKmlGeometries(kml: string): KmlParseResult {
  const geometries: ParsedGeometry[] = [];
  let unlabeledPlacemarks = 0;

  const placemarks = kml.match(PLACEMARK_RE) ?? [];
  for (const placemark of placemarks) {
    const linkZona = extractLinkZona(placemark);
    if (linkZona == null || linkZona === '') {
      unlabeledPlacemarks++;
      continue;
    }
    const rings: [number, number][][] = [];
    for (const m of placemark.matchAll(COORDS_RE)) {
      const ring = parseCoordinates(m[1] ?? '');
      if (ring.length > 0) rings.push(ring);
    }
    if (rings.length > 0) geometries.push({ linkZona, rings });
  }

  return { geometries, unlabeledPlacemarks };
}
