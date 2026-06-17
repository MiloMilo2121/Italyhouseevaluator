-- 0010_omi_upsert_function.sql
-- Upsert idempotente delle quotazioni OMI con costruzione geometria. Questa è
-- una ROUTINE DI INGESTION dati (non business logic di valutazione): è il punto
-- corretto dove costruire/validare la geometria (ST_GeomFromGeoJSON → SRID 4326
-- → ST_MakeValid). Idempotente sulla chiave (link_zona, semestre, tipologia,
-- stato): ri-eseguire l'ingestion aggiorna senza duplicare. Append per semestre.

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
      g := ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON((r->'geom_geojson')::text), 4326));
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
