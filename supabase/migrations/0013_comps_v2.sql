-- 0013_comps_v2.sql
-- V2: estende `comps` per la cache annunci (dedup per listing, €/mq, attributi
-- per la griglia di omogeneizzazione, timestamp di ingestion) + funzioni di
-- SOLA RISOLUZIONE SPAZIALE (KNN) e di upsert idempotente. Append-only.

alter table comps add column if not exists listing_id text;
alter table comps add column if not exists eur_mq numeric(10, 2);
alter table comps add column if not exists piano integer;
alter table comps add column if not exists ascensore boolean;
alter table comps add column if not exists classe_energetica text;
alter table comps add column if not exists ingested_at timestamptz not null default now();

create unique index if not exists comps_listing_id_uniq on comps (listing_id) where listing_id is not null;

-- KNN: comparabili entro raggio (metri) e finestra temporale (mesi), per distanza.
create or replace function comps_near(
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision,
  p_max integer,
  p_months integer
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
  source text,
  dist_m double precision
)
language sql
stable
as $$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) as g)
  select c.listing_id, c.eur_mq, c.superficie_commerciale_mq, c.sale_date, c.stato,
         c.link_zona, c.piano, c.ascensore, c.classe_energetica, c.source,
         ST_Distance(c.subject_geom::geography, pt.g::geography) as dist_m
  from comps c, pt
  where c.subject_geom is not null
    and c.eur_mq is not null
    and c.sale_date > (current_date - make_interval(months => p_months))
    and ST_DWithin(c.subject_geom::geography, pt.g::geography, p_radius_m)
  order by c.subject_geom <-> pt.g
  limit p_max;
$$;

-- Upsert idempotente per listing_id; costruisce subject_geom da lat/lng.
-- Routine di ingestion (non business logic): qui si costruisce la geometria.
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
      piano, ascensore, classe_energetica, attributes
    )
    values (
      r->>'listing_id', coalesce(r->>'source', 'annuncio'),
      ST_SetSRID(ST_MakePoint((r->>'lng')::double precision, (r->>'lat')::double precision), 4326),
      nullif(r->>'comune_code', ''), nullif(r->>'property_type', ''),
      (r->>'superficie_mq')::numeric, (r->>'superficie_commerciale_mq')::numeric,
      nullif(r->>'stato', '')::omi_stato_enum, (r->>'price')::numeric, (r->>'eur_mq')::numeric,
      (r->>'sale_date')::date,
      nullif(r->>'piano', '')::integer,
      case when r ? 'ascensore' and r->>'ascensore' <> 'null' then (r->>'ascensore')::boolean else null end,
      nullif(r->>'classe_energetica', ''),
      coalesce(r->'attributes', '{}'::jsonb)
    )
    on conflict (listing_id) do update set
      price = excluded.price, eur_mq = excluded.eur_mq, stato = excluded.stato,
      sale_date = excluded.sale_date, subject_geom = excluded.subject_geom,
      ingested_at = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;
