import { describe, it, expect } from 'vitest';
import {
  closeRing,
  isPointInItaly,
  isValidRing,
  ringsToMultiPolygon,
  sanitizeZoneRings,
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

describe('sanificazione geometrie OMI (bug noti §7)', () => {
  it('bbox Italia: punti in Italia ok, punto "in Africa" no', () => {
    expect(isPointInItaly([9.19, 45.46])).toBe(true);
    expect(isPointInItaly([8.04, 0.04])).toBe(false);
  });

  it('geometria valida in Italia ⇒ accettata senza flag', () => {
    const r = sanitizeZoneRings('MI_1', [ITALY_RING]);
    expect(r.rings).not.toBeNull();
    expect(r.flags).toHaveLength(0);
  });

  it('poligono sardo posizionato in Africa ⇒ scartato e segnalato (non crasha)', () => {
    const r = sanitizeZoneRings('SARD_AFRICA', [AFRICA_RING]);
    expect(r.rings).toBeNull();
    expect(r.flags.some((f) => f.kind === 'geometry_outside_italy')).toBe(true);
  });

  it('ring con troppi pochi vertici ⇒ segnalato come invalido', () => {
    const r = sanitizeZoneRings('BAD', [[[9, 45], [9.1, 45]]]);
    expect(r.rings).toBeNull();
    expect(r.flags.some((f) => f.kind === 'geometry_invalid_ring')).toBe(true);
  });

  it('closeRing chiude un anello aperto; isValidRing controlla chiusura e vertici', () => {
    const open: [number, number][] = [[9, 45], [9.1, 45], [9.1, 45.1]];
    const closed = closeRing(open);
    expect(closed[0]).toEqual(closed[closed.length - 1]);
    expect(isValidRing(closed)).toBe(true);
  });

  it('ringsToMultiPolygon produce un GeoJSON MultiPolygon', () => {
    const mp = ringsToMultiPolygon([ITALY_RING]);
    expect(mp.type).toBe('MultiPolygon');
    expect(mp.coordinates).toHaveLength(1);
    expect(mp.coordinates[0]![0]).toHaveLength(5);
  });
});
