import type { OmiResolver } from '@/lib/valuation/ports';
import type { GeoPoint, OmiResolution } from '@/lib/valuation/types';
import type { OmiQueryClient } from './query-port';

/**
 * Implementazione reale dell'OmiResolver (port del motore). Possiede la FALLBACK
 * LADDER (§6.2): contains → nearest → comune → prior_only. La parte spaziale è
 * delegata all'OmiQueryClient (PostGIS); qui sta solo la logica di degradazione,
 * pura e testabile con un fake client (zero DB).
 */

export interface OmiResolverOptions {
  nearestMaxMeters?: number;
  defaultTipologia?: string;
}

const DEFAULT_NEAREST_M = 1500;
const DEFAULT_TIPOLOGIA = 'Abitazioni civili';

export class OmiResolverImpl implements OmiResolver {
  constructor(
    private readonly client: OmiQueryClient,
    private readonly opts: OmiResolverOptions = {},
  ) {}

  async resolve(
    point: GeoPoint,
    opts?: { comuneCode?: string | null; tipologia?: string },
  ): Promise<OmiResolution> {
    const semestre = await this.client.latestSemestre();
    if (semestre == null) {
      return { zonaOmiId: null, fallbackLevel: 'prior_only', rows: [], semestre: null };
    }

    const tipologia = opts?.tipologia ?? this.opts.defaultTipologia ?? DEFAULT_TIPOLOGIA;
    const maxMeters = this.opts.nearestMaxMeters ?? DEFAULT_NEAREST_M;

    // 1. La zona che contiene il punto.
    const contained = await this.client.zoneContaining(point, semestre, tipologia);
    if (contained && contained.rows.length > 0) {
      return { zonaOmiId: contained.linkZona, fallbackLevel: 'none', rows: contained.rows, semestre };
    }

    // 2. Zona più vicina (gap di copertura / geocoding impreciso).
    const nearest = await this.client.nearestZone(point, maxMeters, semestre, tipologia);
    if (nearest && nearest.rows.length > 0) {
      return { zonaOmiId: nearest.linkZona, fallbackLevel: 'nearest', rows: nearest.rows, semestre };
    }

    // 3. Aggregato a livello comune.
    if (opts?.comuneCode) {
      const comuneRows = await this.client.comuneRows(opts.comuneCode, semestre, tipologia);
      if (comuneRows.length > 0) {
        return { zonaOmiId: null, fallbackLevel: 'comune', rows: comuneRows, semestre };
      }
    }

    // 4. Nessun dato usabile.
    return { zonaOmiId: null, fallbackLevel: 'prior_only', rows: [], semestre: null };
  }
}
