import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import type { ComparablesProvider, ComparablesQueryOpts } from './ports';
import type { Comparable, CompSource, OmiStato, SubjectProperty } from './types';

/**
 * Provider comparabili backed da Supabase/PostGIS (V2). Chiama la funzione KNN
 * `comps_near` (migrazione 0013) — solo recupero candidati; il MCA e ogni
 * decisione restano in TS. È l'unico punto che tocca il DB per i comps;
 * integration-tested su ambiente reale, qui build-verified.
 */

interface CompNearRow {
  listing_id: string;
  eur_mq: number | string;
  superficie_commerciale_mq: number | string;
  sale_date: string;
  stato: OmiStato | null;
  link_zona: string | null;
  piano: number | null;
  ascensore: boolean | null;
  classe_energetica: string | null;
  source: string | null;
  dist_m: number | string;
}

export class SupabaseComparablesProvider implements ComparablesProvider {
  constructor(private readonly client: SupabaseRpcClient) {}

  async find(subject: SubjectProperty, opts?: ComparablesQueryOpts): Promise<Comparable[]> {
    const { data, error } = await this.client.rpc('comps_near', {
      p_lng: subject.location.lng,
      p_lat: subject.location.lat,
      p_radius_m: opts?.radiusMeters ?? 1500,
      p_max: opts?.limit ?? 12,
      p_months: opts?.months ?? 18,
    });
    if (error) throw new Error(`comps_near fallita: ${error.message}`);
    const rows = (data as CompNearRow[] | null) ?? [];
    const omiZone = opts?.omiZone ?? null;

    return rows
      .filter((r) => r.stato != null)
      .map((r) => ({
        id: r.listing_id,
        distanceMeters: Number(r.dist_m),
        superficieCommercialeMq: Number(r.superficie_commerciale_mq),
        pricePerMq: Number(r.eur_mq),
        saleDate: r.sale_date,
        stato: r.stato as OmiStato,
        sameOmiZone: omiZone != null && r.link_zona === omiZone,
        source: (r.source as CompSource | null) ?? 'annuncio',
        piano: r.piano,
        pianiEdificio: null,
        pianoLabel: null,
        ascensore: r.ascensore,
        classeEnergetica: r.classe_energetica,
      }));
  }
}
