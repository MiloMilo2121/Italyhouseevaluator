import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseOmiQueryClient, type SupabaseRpcClient } from '@/lib/omi/query-supabase';
import { OmiResolverImpl } from '@/lib/omi/resolver';
import type { OmiUpsertRow } from '@/lib/omi/types';

/**
 * Integrazione PostGIS reale: valida che ST_Contains/nearest funzionino sul DB
 * (il fake resolver di M2 NON valida lo spaziale). GUARDATO: gira solo se sono
 * configurati URL/chiave di un progetto di test con le migrazioni applicate
 * (incl. 0009/0010). Escluso dal run di default; avvio: `npm run test:integration`.
 *
 * Qui si esercita il caso felice (contains) + il bordo (punto lontano →
 * prior_only). I bug geometrici noti (Forlì-Cesena, poligono sardo, punti
 * esattamente sul confine) vanno aggiunti con geometrie reali quando disponibili.
 */

const url = process.env['OMI_TEST_SUPABASE_URL'];
const key = process.env['OMI_TEST_SUPABASE_SERVICE_KEY'];
const enabled = Boolean(url && key);

const SEM = '2099-1'; // semestre fittizio nel futuro: diventa il max(semestre)
const TIPOLOGIA = 'Abitazioni civili';

function seedRow(stato: 'Ottimo' | 'Normale' | 'Scadente', min: number, max: number): OmiUpsertRow {
  return {
    link_zona: 'IT_TEST_1',
    comune_code: 'F205',
    comune_amm: 'MILANO',
    fascia: 'B',
    tipologia: TIPOLOGIA,
    stato,
    compr_min: min,
    compr_max: max,
    loc_min: null,
    loc_max: null,
    semestre: SEM,
    geom_geojson: {
      type: 'MultiPolygon',
      coordinates: [[[[9.18, 45.46], [9.2, 45.46], [9.2, 45.475], [9.18, 45.475], [9.18, 45.46]]]],
    },
  };
}

describe.skipIf(!enabled)('integrazione PostGIS ST_Contains (DB reale)', () => {
  // Inizializzazione lazy: createClient gira solo quando la suite è abilitata
  // (non a collect time, dove url/key potrebbero mancare).
  let client: ReturnType<typeof createClient>;
  let resolver: OmiResolverImpl;

  beforeAll(async () => {
    client = createClient(url!, key!, { auth: { persistSession: false } });
    const rpc = client as unknown as SupabaseRpcClient;
    resolver = new OmiResolverImpl(new SupabaseOmiQueryClient(rpc));
    const rows = [seedRow('Ottimo', 3500, 4200), seedRow('Normale', 2800, 3400)];
    const { error } = await rpc.rpc('omi_upsert_quotations', { p_rows: rows });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await client.from('omi_quotations').delete().eq('semestre', SEM);
  });

  it('punto dentro la zona ⇒ contains (fallback none) con le righe per stato', async () => {
    const r = await resolver.resolve({ lat: 45.467, lng: 9.19 });
    expect(r.fallbackLevel).toBe('none');
    expect(r.zonaOmiId).toBe('IT_TEST_1');
    expect(r.rows.map((x) => x.stato).sort()).toEqual(['Normale', 'Ottimo']);
  });

  it('punto molto lontano, senza comune ⇒ prior_only', async () => {
    const r = await resolver.resolve({ lat: 40.0, lng: 14.5 });
    expect(r.fallbackLevel).toBe('prior_only');
  });
});
