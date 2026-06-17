import { describe, it, expect } from 'vitest';
import { parseCoordinates, parseKmlGeometries } from '@/lib/omi/kml';
import { SAMPLE_KML } from './fixtures/omi-sample.fixture';

describe('parsing KML OMI (§7)', () => {
  it('estrae i ring dai blocchi <coordinates> (lng,lat[,alt])', () => {
    const ring = parseCoordinates('9.18,45.46,0 9.20,45.46,0 9.20,45.47,0 9.18,45.46,0');
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual([9.18, 45.46]);
  });

  it('estrae le geometrie associate al LinkZona dall’ExtendedData', () => {
    const { geometries } = parseKmlGeometries(SAMPLE_KML);
    const ids = geometries.map((g) => g.linkZona).sort();
    expect(ids).toEqual(['MI_1', 'SARD_AFRICA']);
    const mi1 = geometries.find((g) => g.linkZona === 'MI_1')!;
    expect(mi1.rings[0]).toHaveLength(5);
  });

  it('fallback su <name> quando manca SimpleData LinkZona', () => {
    const kml = `<kml><Placemark><name>ZZ_9</name><Polygon><outerBoundaryIs><LinearRing>
      <coordinates>9,45 9.1,45 9.1,45.1 9,45.1 9,45</coordinates>
      </LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
    const { geometries } = parseKmlGeometries(kml);
    expect(geometries).toHaveLength(1);
    expect(geometries[0]!.linkZona).toBe('ZZ_9');
  });
});
