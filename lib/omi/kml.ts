import type { ParsedGeometry } from './types';

/**
 * Estrazione delle geometrie zona dal KML OMI (pura, senza dipendenze DOM:
 * estrazione via regex, sufficiente per il tracciato OMI). La sanificazione
 * (bbox Italia, ring) è in geometry.ts; qui si estraggono solo i ring grezzi.
 *
 * Chiave di join (`linkZona` su ParsedGeometry, semantica = chiave geometrica):
 *   1. formato reale "perimetri OMI": ExtendedData <Data name="CODCOM">/<CODZONA>
 *      → chiave composita `${CODCOM}_${CODZONA}` (il campo LINKZONA del KML è
 *      vuoto), che combacia con `${Comune_amm}_${Zona}` del file VALORI;
 *   2. legacy: <SimpleData name="LinkZona">…</SimpleData>;
 *   3. fallback: <name>…</name>.
 */

const PLACEMARK_RE = /<Placemark\b[\s\S]*?<\/Placemark>/g;
const LINKZONA_SIMPLEDATA_RE = /<SimpleData\s+name="LinkZona">([\s\S]*?)<\/SimpleData>/i;
const NAME_RE = /<name>([\s\S]*?)<\/name>/i;
const COORDS_RE = /<coordinates>([\s\S]*?)<\/coordinates>/gi;
const POLYGON_RE = /<Polygon\b[\s\S]*?<\/Polygon>/gi;
const OUTER_RE = /<outerBoundaryIs\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/i;
const INNER_RE = /<innerBoundaryIs\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/gi;

/** Estrae il <value> di un <Data name="KEY"> dall'ExtendedData (case-insensitive sul name). */
function extractDataValue(placemark: string, name: string): string | null {
  const re = new RegExp(`<Data\\s+name="${name}"[^>]*>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`, 'i');
  const m = placemark.match(re);
  return m?.[1] != null ? m[1].trim() : null;
}

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
  // 1. Formato reale: chiave composita CODCOM_CODZONA (uppercase per join robusto).
  const codCom = extractDataValue(placemark, 'CODCOM');
  const codZona = extractDataValue(placemark, 'CODZONA');
  if (codCom && codZona) return `${codCom}_${codZona}`.toUpperCase();
  // Fail-loud: se l'ExtendedData OMI è presente ma parziale (uno dei due
  // mancante/vuoto) NON si ripiega su <name> — fabbricherebbe una chiave fantasma
  // che non combacia mai col VALORI. Si scarta (conteggiato come unlabeled).
  if (codCom !== null || codZona !== null) return null;
  // 2. Legacy: SimpleData LinkZona.
  const sd = placemark.match(LINKZONA_SIMPLEDATA_RE);
  if (sd?.[1]?.trim()) return sd[1].trim();
  // 3. Fallback: <name> (solo KML senza ExtendedData OMI).
  const nm = placemark.match(NAME_RE);
  if (nm?.[1]?.trim()) return nm[1].trim();
  return null;
}

export interface KmlParseResult {
  geometries: ParsedGeometry[];
  /** Placemark senza LinkZona riconoscibile. */
  unlabeledPlacemarks: number;
}

/**
 * Estrae i poligoni di un Placemark rispettando i fori: per ogni <Polygon>
 * l'anello esterno (outerBoundaryIs) e i fori (innerBoundaryIs). Fallback: se un
 * blocco non usa outer/innerBoundaryIs, il primo <coordinates> è l'esterno e gli
 * altri sono fori; se non ci sono <Polygon>, ogni <coordinates> del placemark è
 * un poligono separato (compatibilità con KML semplificati).
 */
function extractPolygons(placemark: string): [number, number][][][] {
  const polygons: [number, number][][][] = [];
  const polygonBlocks = placemark.match(POLYGON_RE) ?? [];

  for (const block of polygonBlocks) {
    const outerMatch = block.match(OUTER_RE);
    let outer = outerMatch ? parseCoordinates(outerMatch[1] ?? '') : [];
    const holes: [number, number][][] = [];
    for (const m of block.matchAll(INNER_RE)) {
      const hole = parseCoordinates(m[1] ?? '');
      if (hole.length > 0) holes.push(hole);
    }
    // Fallback per blocchi senza outer/innerBoundaryIs espliciti.
    if (outer.length === 0) {
      const rings = [...block.matchAll(COORDS_RE)].map((m) => parseCoordinates(m[1] ?? '')).filter((r) => r.length > 0);
      if (rings.length === 0) continue;
      outer = rings[0]!;
      holes.push(...rings.slice(1));
    }
    polygons.push([outer, ...holes]);
  }

  // Nessun <Polygon>: ogni <coordinates> del placemark = un poligono a sé.
  if (polygons.length === 0) {
    for (const m of placemark.matchAll(COORDS_RE)) {
      const ring = parseCoordinates(m[1] ?? '');
      if (ring.length > 0) polygons.push([ring]);
    }
  }

  return polygons;
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
    const polygons = extractPolygons(placemark);
    if (polygons.length > 0) geometries.push({ linkZona, polygons });
  }

  return { geometries, unlabeledPlacemarks };
}
