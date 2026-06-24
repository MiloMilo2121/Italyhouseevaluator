-- 0024_comps_locali.sql
-- Attributi per la stima edonica / similarità (Fase 2): n. locali come colonna
-- indicizzabile (la similarità "stesso n. camere" è frequente); terrazzo/balcone
-- restano in `attributes` jsonb. Ricrea comps_upsert per mappare `locali`.

alter table comps add column if not exists locali integer;

create or replace function comps_upsert(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  r jsonb;
  n integer := 0;
begin
  for r in select value from jsonb_array_elements(p_rows) as t(value) loop
    insert into comps (
      listing_id, source, subject_geom, comune_code, property_type,
      superficie_mq, superficie_commerciale_mq, stato, price, eur_mq, sale_date,
      piano, ascensore, classe_energetica, locali, attributes
    )
    values (
      r->>'listing_id', coalesce(r->>'source', 'annuncio'),
      ST_SetSRID(ST_MakePoint((r->>'lng')::double precision, (r->>'lat')::double precision), 4326),
      nullif(r->>'comune_code', ''), nullif(r->>'property_type', '')::property_type_enum,
      (r->>'superficie_mq')::numeric, (r->>'superficie_commerciale_mq')::numeric,
      nullif(r->>'stato', '')::omi_stato_enum, (r->>'price')::numeric, (r->>'eur_mq')::numeric,
      (r->>'sale_date')::date,
      nullif(r->>'piano', '')::integer,
      case when r ? 'ascensore' and r->>'ascensore' <> 'null' then (r->>'ascensore')::boolean else null end,
      nullif(r->>'classe_energetica', ''),
      nullif(r->>'locali', '')::integer,
      coalesce(r->'attributes', '{}'::jsonb)
    )
    on conflict (listing_id) do update set
      price = excluded.price, eur_mq = excluded.eur_mq, stato = excluded.stato,
      sale_date = excluded.sale_date, subject_geom = excluded.subject_geom,
      locali = excluded.locali, attributes = excluded.attributes,
      ingested_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;
