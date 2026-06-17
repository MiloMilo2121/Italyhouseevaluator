import { describe, it, expect } from 'vitest';
import { OmiResolverImpl } from '@/lib/omi/resolver';
import type { OmiQueryClient, ZoneCandidate } from '@/lib/omi/query-port';
import type { GeoPoint, OmiQuotationRow } from '@/lib/valuation/types';

const POINT: GeoPoint = { lat: 45.467, lng: 9.19 };

const rowsFor = (linkZona: string): OmiQuotationRow[] => [
  { linkZona, comuneCode: 'F205', fascia: 'B', tipologia: 'Abitazioni civili', stato: 'Normale', comprMin: 2800, comprMax: 3400, semestre: '2024-2' },
];
const candidate = (linkZona: string): ZoneCandidate => ({ linkZona, comuneAmm: 'MILANO', rows: rowsFor(linkZona) });

interface FakeCfg {
  semestre?: string | null;
  containing?: ZoneCandidate | null;
  nearest?: ZoneCandidate | null;
  comune?: OmiQuotationRow[];
}

class FakeQueryClient implements OmiQueryClient {
  constructor(private readonly cfg: FakeCfg) {}
  async latestSemestre(): Promise<string | null> {
    return this.cfg.semestre === undefined ? '2024-2' : this.cfg.semestre;
  }
  async zoneContaining(): Promise<ZoneCandidate | null> {
    return this.cfg.containing ?? null;
  }
  async nearestZone(): Promise<ZoneCandidate | null> {
    return this.cfg.nearest ?? null;
  }
  async comuneRows(): Promise<OmiQuotationRow[]> {
    return this.cfg.comune ?? [];
  }
}

describe('fallback ladder del resolver (§6.2) — pura, zero DB', () => {
  it('contains ⇒ fallback none', async () => {
    const r = await new OmiResolverImpl(new FakeQueryClient({ containing: candidate('MI_1') })).resolve(POINT);
    expect(r.fallbackLevel).toBe('none');
    expect(r.zonaOmiId).toBe('MI_1');
    expect(r.rows).toHaveLength(1);
  });

  it('niente contains ⇒ nearest', async () => {
    const r = await new OmiResolverImpl(new FakeQueryClient({ containing: null, nearest: candidate('MI_2') })).resolve(POINT);
    expect(r.fallbackLevel).toBe('nearest');
    expect(r.zonaOmiId).toBe('MI_2');
  });

  it('niente contains/nearest, ma righe comune ⇒ comune', async () => {
    const r = await new OmiResolverImpl(
      new FakeQueryClient({ containing: null, nearest: null, comune: rowsFor('COMUNE') }),
    ).resolve(POINT, { comuneCode: 'F205' });
    expect(r.fallbackLevel).toBe('comune');
    expect(r.zonaOmiId).toBeNull();
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('nessun dato ⇒ prior_only', async () => {
    const r = await new OmiResolverImpl(new FakeQueryClient({})).resolve(POINT, { comuneCode: 'F205' });
    expect(r.fallbackLevel).toBe('prior_only');
    expect(r.rows).toHaveLength(0);
  });

  it('nessun semestre ingerito ⇒ prior_only immediato', async () => {
    const r = await new OmiResolverImpl(new FakeQueryClient({ semestre: null })).resolve(POINT);
    expect(r.fallbackLevel).toBe('prior_only');
    expect(r.semestre).toBeNull();
  });

  it('candidate con rows vuoto non vince: scende al livello successivo', async () => {
    const empty: ZoneCandidate = { linkZona: 'X', comuneAmm: null, rows: [] };
    const r = await new OmiResolverImpl(
      new FakeQueryClient({ containing: empty, nearest: candidate('MI_9') }),
    ).resolve(POINT);
    expect(r.fallbackLevel).toBe('nearest');
    expect(r.zonaOmiId).toBe('MI_9');
  });
});
