-- 0022_omi_upsert_geometry_fix.sql
-- Fix ingestion geometria su due fronti:
--  1) ST_MakeValid su poligoni OMI auto-intersecanti puo' restituire una
--     GeometryCollection (poligoni + linee/punti di degenerazione), che NON
--     entra nella colonna geometry(MultiPolygon). Si estraggono solo le parti
--     poligonali (ST_CollectionExtract type=3) e si forza MultiPolygon (ST_Multi).
--  2) Le geometrie OMI hanno vertici sub-metrici: salvarle integrali (e duplicate
--     per ogni riga zona×tipologia×stato) satura il disco. Per il point-in-polygon
--     di una ZONA (quartiere) bastano perimetri grossolani: si semplifica con
--     ST_SimplifyPreserveTopology (~0.0002° ≈ 20m), riducendo i vertici ~20-30×.
-- Geometria vuota dopo l'estrazione ⇒ null (riga comune-only).

create or replace function omi_upsert_quotations(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  r jsonb;
  g geometry;
  n integer := 0;
begin
  for r in select value from jsonb_array_elements(p_rows) as t(value) loop
    g := null;
    if jsonb_typeof(r->'geom_geojson') = 'object' then
      g := ST_Multi(
        ST_CollectionExtract(
          ST_MakeValid(
            ST_SimplifyPreserveTopology(
              ST_SetSRID(ST_GeomFromGeoJSON((r->'geom_geojson')::text), 4326),
              0.0002
            )
          ),
          3
        )
      );
      if g is null or ST_IsEmpty(g) then
        g := null;
      end if;
    end if;

    insert into omi_quotations (
      link_zona, comune_code, comune_amm, fascia, tipologia, stato,
      compr_min, compr_max, loc_min, loc_max, semestre, geom
    )
    values (
      r->>'link_zona',
      r->>'comune_code',
      nullif(r->>'comune_amm', ''),
      (r->>'fascia')::fascia_enum,
      r->>'tipologia',
      (r->>'stato')::omi_stato_enum,
      (r->>'compr_min')::numeric,
      (r->>'compr_max')::numeric,
      (r->>'loc_min')::numeric,
      (r->>'loc_max')::numeric,
      r->>'semestre',
      g
    )
    on conflict (link_zona, semestre, tipologia, stato) do update set
      comune_code = excluded.comune_code,
      comune_amm  = excluded.comune_amm,
      fascia      = excluded.fascia,
      compr_min   = excluded.compr_min,
      compr_max   = excluded.compr_max,
      loc_min     = excluded.loc_min,
      loc_max     = excluded.loc_max,
      geom        = excluded.geom;

    n := n + 1;
  end loop;
  return n;
end;
$$;
