import type { SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { marketGroupFor } from '@/lib/comps/property-groups';
import { WIDE_RADIUS_M } from '@/lib/comps/apify-input';
import type { ComparablesProvider, ComparablesQueryOpts } from './ports';
import type { Comparable, CompSource, OmiStato, SubjectProperty } from './types';

/**
 * Provider comparabili backed da Supabase/PostGIS (V2). Chiama la funzione KNN
 * `comps_near` (migrazioni 0013 + 0023 + 0025) — solo recupero candidati; il MCA e
 * ogni decisione restano in TS. Recupera il RAGGIO LARGO (~3 km, max ~80) ordinato
 * per distanza: lo split nearest/wide per la stima edonica è a valle (puro). Filtra
 * per GRUPPO DI MERCATO della tipologia subject. È l'unico punto che tocca il DB per
 * i comps; integration-tested su reale, qui build-verified.
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
  locali: number | null;
  attributes: Record<string, unknown> | null;
  source: string | null;
  dist_m: number | string;
}

function attrBool(attrs: Record<string, unknown> | null, key: string): boolean | null {
  const v = attrs?.[key];
  return typeof v === 'boolean' ? v : null;
}

export class SupabaseComparablesProvider implements ComparablesProvider {
  constructor(private readonly client: SupabaseRpcClient) {}

  async find(subject: SubjectProperty, opts?: ComparablesQueryOpts): Promise<Comparable[]> {
    const { data, error } = await this.client.rpc('comps_near', {
      p_lng: subject.location.lng,
      p_lat: subject.location.lat,
      p_radius_m: opts?.wideRadiusMeters ?? opts?.radiusMeters ?? WIDE_RADIUS_M,
      p_max: opts?.limit ?? 80,
      p_months: opts?.months ?? 18,
      // Solo comparabili dello stesso gruppo di mercato (residenziale verticale /
      // orizzontale / rustico): i €/mq non sono confrontabili tra gruppi diversi.
      p_property_types: marketGroupFor(subject.propertyType),
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
        locali: r.locali,
        hasTerrazzo: attrBool(r.attributes, 'terrazzo'),
        hasBalcone: attrBool(r.attributes, 'balcone'),
      }));
  }
}
