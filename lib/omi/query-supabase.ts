import type { GeoPoint, OmiQuotationRow, OmiStato } from '@/lib/valuation/types';
import type { OmiQueryClient, ZoneCandidate } from './query-port';
import { round2 } from '@/lib/valuation/util';

/**
 * Adapter Supabase del port OmiQueryClient: chiama le funzioni SQL di
 * risoluzione spaziale (migrazione 0009) via RPC. È l'UNICO punto che tocca il
 * DB; integration-tested (guardato) su geometrie reali. L'aggregazione comune
 * per stato è fatta qui in TS (no logica in SQL).
 */

/** Interfaccia minima compatibile con SupabaseClient.rpc (facilita il mock). */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface RawOmiRow {
  link_zona: string;
  comune_code: string;
  comune_amm: string | null;
  fascia: string;
  tipologia: string;
  stato: OmiStato;
  compr_min: number | string;
  compr_max: number | string;
  semestre: string;
}

function toRow(r: RawOmiRow): OmiQuotationRow {
  return {
    linkZona: r.link_zona,
    comuneCode: r.comune_code,
    fascia: r.fascia,
    tipologia: r.tipologia,
    stato: r.stato,
    comprMin: Number(r.compr_min),
    comprMax: Number(r.compr_max),
    semestre: r.semestre,
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

export class SupabaseOmiQueryClient implements OmiQueryClient {
  constructor(private readonly client: SupabaseRpcClient) {}

  private async callRows(fn: string, args: Record<string, unknown>): Promise<RawOmiRow[]> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`RPC ${fn} fallita: ${error.message}`);
    return (data as RawOmiRow[] | null) ?? [];
  }

  async latestSemestre(): Promise<string | null> {
    const { data, error } = await this.client.rpc('omi_latest_semestre');
    if (error) throw new Error(`RPC omi_latest_semestre fallita: ${error.message}`);
    return (data as string | null) ?? null;
  }

  private toCandidate(raw: RawOmiRow[]): ZoneCandidate | null {
    if (raw.length === 0) return null;
    const first = raw[0]!;
    return { linkZona: first.link_zona, comuneAmm: first.comune_amm, rows: raw.map(toRow) };
  }

  async zoneContaining(point: GeoPoint, semestre: string, tipologia: string): Promise<ZoneCandidate | null> {
    const raw = await this.callRows('omi_zone_containing', {
      p_lng: point.lng,
      p_lat: point.lat,
      p_semestre: semestre,
      p_tipologia: tipologia,
    });
    return this.toCandidate(raw);
  }

  async nearestZone(
    point: GeoPoint,
    maxMeters: number,
    semestre: string,
    tipologia: string,
  ): Promise<ZoneCandidate | null> {
    const raw = await this.callRows('omi_zone_nearest', {
      p_lng: point.lng,
      p_lat: point.lat,
      p_max_m: maxMeters,
      p_semestre: semestre,
      p_tipologia: tipologia,
    });
    return this.toCandidate(raw);
  }

  async comuneRows(comuneCode: string, semestre: string, tipologia: string): Promise<OmiQuotationRow[]> {
    const raw = await this.callRows('omi_comune_rows', {
      p_comune_code: comuneCode,
      p_semestre: semestre,
      p_tipologia: tipologia,
    });
    // Aggregazione per stato (media dei €/mq tra le zone del comune).
    const byStato = new Map<OmiStato, { min: number[]; max: number[] }>();
    for (const r of raw) {
      const acc = byStato.get(r.stato) ?? { min: [], max: [] };
      acc.min.push(Number(r.compr_min));
      acc.max.push(Number(r.compr_max));
      byStato.set(r.stato, acc);
    }
    const out: OmiQuotationRow[] = [];
    for (const [stato, acc] of byStato) {
      out.push({
        linkZona: 'COMUNE',
        comuneCode,
        fascia: 'R',
        tipologia,
        stato,
        comprMin: avg(acc.min),
        comprMax: avg(acc.max),
        semestre,
      });
    }
    return out;
  }
}
