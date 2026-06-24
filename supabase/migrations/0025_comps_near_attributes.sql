-- 0025_comps_near_attributes.sql
-- comps_near ritorna anche `locali` e `attributes` (terrazzo/balcone in jsonb)
-- per la stima edonica / similarità (Fase 2). Mantiene il filtro per gruppo di
-- mercato (0023). Recreate completo della funzione (cambio returns-table).

drop function if exists comps_near(double precision, double precision, double precision, integer, integer);
drop function if exists comps_near(double precision, double precision, double precision, integer, integer, text[]);

create or replace function comps_near(
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision,
  p_max integer,
  p_months integer,
  p_property_types text[] default null
)
returns table (
  listing_id text,
  eur_mq numeric,
  superficie_commerciale_mq numeric,
  sale_date date,
  stato omi_stato_enum,
  link_zona text,
  piano integer,
  ascensore boolean,
  classe_energetica text,
  locali integer,
  attributes jsonb,
  source text,
  dist_m double precision
)
language sql
stable
as $$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) as g)
  select c.listing_id, c.eur_mq, c.superficie_commerciale_mq, c.sale_date, c.stato,
         c.link_zona, c.piano, c.ascensore, c.classe_energetica, c.locali, c.attributes, c.source,
         ST_Distance(c.subject_geom::geography, pt.g::geography) as dist_m
  from comps c, pt
  where c.subject_geom is not null
    and c.eur_mq is not null
    and c.sale_date > (current_date - make_interval(months => p_months))
    and ST_DWithin(c.subject_geom::geography, pt.g::geography, p_radius_m)
    and (
      p_property_types is null
      or array_length(p_property_types, 1) is null
      or c.property_type = any (p_property_types::property_type_enum[])
    )
  order by c.subject_geom <-> pt.g
  limit p_max;
$$;
