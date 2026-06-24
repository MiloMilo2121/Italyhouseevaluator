/**
 * Input degli actor Apify per lo scrape comparabili (Fase 1), PURO.
 *
 * Gli actor immobiliare.it / idealista scrappano per AREA (bbox/search-URL), non
 * per raggio metrico. Si calcola un bounding box attorno al subject (raggio largo
 * ~3 km); il cerchio metrico preciso lo ritaglia poi `comps_near` (ST_DWithin) a
 * valle. Un solo run sul bbox largo popola la cache `comps`; i "2 raggi" sono due
 * query a valle. La FORMA esatta dell'input dipende dall'actor scelto (validata
 * in deploy): qui è incapsulata e parametrica.
 */

export const WIDE_RADIUS_M = 3000;
const M_PER_DEG_LAT = 111_320;

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Bounding box quadrato di semi-lato `radiusMeters` attorno a (lat,lng). */
export function bboxAround(lat: number, lng: number, radiusMeters: number = WIDE_RADIUS_M): BBox {
  const dLat = radiusMeters / M_PER_DEG_LAT;
  const dLng = radiusMeters / (M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng };
}

export interface ScrapeCenter {
  lat: number;
  lng: number;
}

export interface ApifyScrapeInput {
  bbox: BBox;
  maxItems: number;
  [key: string]: unknown;
}

/** Input per l'actor Immobiliare.it (mapBounds NE/SW + cap risultati). */
export function buildImmobiliareInput(
  center: ScrapeCenter,
  radiusMeters: number = WIDE_RADIUS_M,
  maxItems = 200,
): ApifyScrapeInput {
  const bbox = bboxAround(center.lat, center.lng, radiusMeters);
  return {
    bbox,
    maxItems,
    // Campi tipici dell'actor (da confermare sul run reale): area mappa + tipo annuncio.
    mapBounds: { neLat: bbox.north, neLng: bbox.east, swLat: bbox.south, swLng: bbox.west },
    listingType: 'sale',
  };
}

/** Input per l'actor Idealista (location bbox + operazione vendita). */
export function buildIdealistaInput(
  center: ScrapeCenter,
  radiusMeters: number = WIDE_RADIUS_M,
  maxItems = 200,
): ApifyScrapeInput {
  const bbox = bboxAround(center.lat, center.lng, radiusMeters);
  return {
    bbox,
    maxItems,
    operation: 'sale',
    locationBounds: { topLeft: { lat: bbox.north, lng: bbox.west }, bottomRight: { lat: bbox.south, lng: bbox.east } },
  };
}

export function buildScrapeInput(
  portal: 'immobiliare' | 'idealista',
  center: ScrapeCenter,
  radiusMeters?: number,
  maxItems?: number,
): ApifyScrapeInput {
  return portal === 'immobiliare'
    ? buildImmobiliareInput(center, radiusMeters, maxItems)
    : buildIdealistaInput(center, radiusMeters, maxItems);
}
