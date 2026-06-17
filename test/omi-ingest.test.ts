import { describe, it, expect } from 'vitest';
import { ingestOmi } from '@/lib/omi/ingest';
import { SAMPLE_KML, SAMPLE_VALORI, SAMPLE_ZONE } from './fixtures/omi-sample.fixture';

describe('pipeline di ingestion OMI pura (§7)', () => {
  const result = ingestOmi({
    valoriCsv: SAMPLE_VALORI,
    zoneCsv: SAMPLE_ZONE,
    kml: SAMPLE_KML,
    semestre: '2024-2',
  });

  it('produce le righe di upsert con chiave idempotente e geometria dove presente', () => {
    expect(result.report.quotationsParsed).toBe(3);
    expect(result.report.zonesParsed).toBe(2);
    expect(result.report.geometriesParsed).toBe(1); // solo MI_1 (SARD scartata)
    expect(result.rows).toHaveLength(3);

    const mi1 = result.rows.filter((r) => r.link_zona === 'MI_1');
    expect(mi1).toHaveLength(2);
    expect(mi1.every((r) => r.geom_geojson?.type === 'MultiPolygon')).toBe(true);
    expect(mi1.map((r) => r.stato).sort()).toEqual(['Normale', 'Ottimo']);
  });

  it('locazione 0,00 → null; compravendita preservata', () => {
    const ottimo = result.rows.find((r) => r.link_zona === 'MI_1' && r.stato === 'Ottimo')!;
    expect(ottimo.compr_min).toBe(3500);
    expect(ottimo.compr_max).toBe(4200);
    expect(ottimo.loc_min).toBeNull();
    const normale = result.rows.find((r) => r.link_zona === 'MI_1' && r.stato === 'Normale')!;
    expect(normale.loc_min).toBe(10.5);
  });

  it('zona senza perimetro KML ⇒ riga senza geometria + flag (gap tipo Forlì-Cesena)', () => {
    const mi2 = result.rows.find((r) => r.link_zona === 'MI_2')!;
    expect(mi2.geom_geojson).toBeNull();
    expect(result.report.rowsWithoutGeometry).toBe(1);
    expect(result.report.rowsWithGeometry).toBe(2);
    expect(result.report.flags.some((f) => f.kind === 'missing_geometry' && f.linkZona === 'MI_2')).toBe(true);
  });

  it('geometria fuori Italia segnalata (poligono in Africa)', () => {
    expect(result.report.flags.some((f) => f.kind === 'geometry_outside_italy')).toBe(true);
  });

  it('semestre non valido ⇒ errore', () => {
    expect(() =>
      ingestOmi({ valoriCsv: SAMPLE_VALORI, zoneCsv: SAMPLE_ZONE, kml: SAMPLE_KML, semestre: '24-2' }),
    ).toThrow();
  });
});
