import { describe, it, expect } from 'vitest';
import {
  closeRing,
  isPointInItaly,
  isValidRing,
  polygonsToMultiPolygon,
  sanitizeZonePolygons,
} from '@/lib/omi/geometry';

const ITALY_RING: [number, number][] = [
  [9.18, 45.46],
  [9.2, 45.46],
  [9.2, 45.475],
  [9.18, 45.475],
  [9.18, 45.46],
];
const AFRICA_RING: [number, number][] = [
  [8.0, 0.0],
  [8.1, 0.0],
  [8.1, 0.1],
  [8.0, 0.1],
  [8.0, 0.0],
];
// Foro interno all'ITALY_RING.
const HOLE_RING: [number, number][] = [
  [9.185, 45.465],
  [9.19, 45.465],
  [9.19, 45.47],
  [9.185, 45.47],
  [9.185, 45.465],
];

describe('sanificazione geometrie OMI (bug noti §7)', () => {
  it('bbox Italia: punti in Italia ok, punto "in Africa" no', () => {
    expect(isPointInItaly([9.19, 45.46])).toBe(true);
    expect(isPointInItaly([8.04, 0.04])).toBe(false);
  });

  it('geometria valida in Italia ⇒ accettata senza flag', () => {
    const r = sanitizeZonePolygons('MI_1', [[ITALY_RING]]);
    expect(r.polygons).not.toBeNull();
    expect(r.flags).toHaveLength(0);
  });

  it('poligono sardo posizionato in Africa ⇒ scartato e segnalato (non crasha)', () => {
    const r = sanitizeZonePolygons('SARD_AFRICA', [[AFRICA_RING]]);
    expect(r.polygons).toBeNull();
    expect(r.flags.some((f) => f.kind === 'geometry_outside_italy')).toBe(true);
  });

  it('esterno con troppi pochi vertici ⇒ segnalato come invalido', () => {
    const r = sanitizeZonePolygons('BAD', [[[[9, 45], [9.1, 45]]]]);
    expect(r.polygons).toBeNull();
    expect(r.flags.some((f) => f.kind === 'geometry_invalid_ring')).toBe(true);
  });

  it('i fori (innerBoundaryIs) sono preservati come anelli interni, non poligoni solidi', () => {
    const r = sanitizeZonePolygons('MI_HOLE', [[ITALY_RING, HOLE_RING]]);
    expect(r.polygons).not.toBeNull();
    expect(r.polygons![0]).toHaveLength(2); // esterno + 1 foro nello STESSO poligono
    const mp = polygonsToMultiPolygon(r.polygons!);
    expect(mp.coordinates).toHaveLength(1); // un solo poligono
    expect(mp.coordinates[0]).toHaveLength(2); // con due anelli (esterno + foro)
  });

  it('foro invalido ⇒ scartato il solo foro, il poligono resta valido', () => {
    const badHole: [number, number][] = [[9.185, 45.465], [9.19, 45.465]]; // 2 punti
    const r = sanitizeZonePolygons('MI_BADHOLE', [[ITALY_RING, badHole]]);
    expect(r.polygons).not.toBeNull();
    expect(r.polygons![0]).toHaveLength(1); // solo l'esterno
    expect(r.flags.some((f) => f.kind === 'geometry_invalid_ring')).toBe(true);
  });

  it('closeRing chiude un anello aperto; isValidRing controlla chiusura e vertici', () => {
    const open: [number, number][] = [[9, 45], [9.1, 45], [9.1, 45.1]];
    const closed = closeRing(open);
    expect(closed[0]).toEqual(closed[closed.length - 1]);
    expect(isValidRing(closed)).toBe(true);
  });

  it('polygonsToMultiPolygon produce un GeoJSON MultiPolygon', () => {
    const mp = polygonsToMultiPolygon([[ITALY_RING]]);
    expect(mp.type).toBe('MultiPolygon');
    expect(mp.coordinates).toHaveLength(1);
    expect(mp.coordinates[0]![0]).toHaveLength(5);
  });
});
