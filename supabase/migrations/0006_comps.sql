-- 0006_comps.sql
-- Comparabili dell'agenzia. VUOTA in Fase 1, predisposta per Scenario A /
-- flywheel (MCA pesato in Fase 2). Copre già gli input della pesatura:
-- distanza (subject_geom), tempo (sale_date), similarità (attributes), zona
-- (link_zona). Nessuna FK su link_zona: omi_quotations è storicizzata.

create table comps (
  id                        uuid primary key default gen_random_uuid(),
  source                    text not null default 'agency',  -- 'agency' | 'annuncio' | ...
  subject_geom              geometry(Point, 4326),
  comune_code               text,
  link_zona                 text,                              -- soft link a zona OMI
  property_type             property_type_enum,
  superficie_mq             numeric(8, 2),
  superficie_commerciale_mq numeric(8, 2),
  stato                     omi_stato_enum,
  price                     numeric(12, 2) not null,
  sale_date                 date not null,
  attributes                jsonb not null default '{}',       -- bag flessibile per attrs Scenario A
  created_at                timestamptz not null default now()
);

create index comps_geom_gix on comps using gist (subject_geom);
create index comps_zona_idx on comps (link_zona);
create index comps_sale_date_idx on comps (sale_date desc);
