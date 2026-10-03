-- =============================================================================
-- valutatore_schema.sql — BASELINE consolidata dello schema
-- =============================================================================
-- Questo file è la vista consolidata, in singolo file, dello schema. La SORGENTE
-- DI VERITÀ per l'applicazione incrementale sono le migrazioni versionate in
-- /supabase/migrations/0001..0026. Tenere i due allineati: ogni nuova migrazione
-- va riflessa qui.
-- Fonte dati di riferimento: Agenzia delle Entrate – OMI.
-- =============================================================================

-- ---- Estensioni (0001) ----
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---- Enum (0002) ----
create type intent_enum as enum ('vendere_ora', 'vendere_dopo', 'comprare_ora', 'comprare_dopo');
create type property_type_enum as enum ('appartamento', 'attico', 'mansarda', 'casa_indipendente', 'loft', 'rustico_casale', 'villa', 'villetta_schiera');
create type condizioni_enum as enum ('nuova', 'ristrutturata', 'parz_ristrutturata', 'da_ristrutturare');
create type riscaldamento_enum as enum ('autonomo', 'centralizzato', 'assente');
create type fascia_enum as enum ('B', 'C', 'D', 'E', 'R');
create type omi_stato_enum as enum ('Ottimo', 'Normale', 'Scadente');
create type fallback_level_enum as enum ('none', 'nearest', 'comune', 'prior_only');
create type valuation_status_enum as enum ('pending', 'enriched', 'completed');
create type lead_status_enum as enum ('new', 'contacted', 'qualified', 'closed');

-- ---- coefficient_sets (0003) ----
-- INVARIANTE: append-only. Un set attivo non si modifica mai in-place.
create table coefficient_sets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  version            integer not null,
  active             boolean not null default false,
  superficie_weights jsonb not null,
  merit_coefficients jsonb not null,
  created_at         timestamptz not null default now(),
  unique (name, version)
);
create unique index coefficient_sets_one_active on coefficient_sets (active) where (active = true);

-- ---- leads (0004) ----
create table leads (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  cognome           text not null,
  email             text not null,
  telefono          text,
  consent_privacy   boolean not null,
  consent_marketing boolean not null default false,
  intent            intent_enum not null,
  is_priority       boolean not null default false,
  status            lead_status_enum not null default 'new',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index leads_email_idx on leads (lower(email));
create index leads_created_at_idx on leads (created_at desc);

-- ---- omi_quotations (0005) ----
create table omi_quotations (
  id          uuid primary key default gen_random_uuid(),
  link_zona   text not null,
  comune_amm  text,
  comune_code text not null,
  fascia      fascia_enum not null,
  tipologia   text not null,
  stato       omi_stato_enum not null,
  compr_min   numeric(10, 2) not null,
  compr_max   numeric(10, 2) not null,
  loc_min     numeric(10, 2),
  loc_max     numeric(10, 2),
  semestre    text not null,
  geom        geometry(MultiPolygon, 4326),
  created_at  timestamptz not null default now(),
  constraint omi_quotations_uniq unique (link_zona, semestre, tipologia, stato)
);
create index omi_quotations_geom_gix on omi_quotations using gist (geom);
create index omi_quotations_comune_idx on omi_quotations (comune_code, semestre);
create index omi_quotations_zona_idx on omi_quotations (link_zona, semestre);

-- ---- comps (0006, 0013, 0024) ----
create table comps (
  id                        uuid primary key default gen_random_uuid(),
  listing_id                text,
  source                    text not null default 'agency',
  subject_geom              geometry(Point, 4326),
  comune_code               text,
  link_zona                 text,
  property_type             property_type_enum,
  superficie_mq             numeric(8, 2),
  superficie_commerciale_mq numeric(8, 2),
  stato                     omi_stato_enum,
  price                     numeric(12, 2) not null,
  eur_mq                    numeric(10, 2),
  sale_date                 date not null,
  piano                     integer,
  ascensore                 boolean,
  classe_energetica         text,
  locali                    integer,
  attributes                jsonb not null default '{}',
  ingested_at               timestamptz not null default now(),
  created_at                timestamptz not null default now()
);
create index comps_geom_gix on comps using gist (subject_geom);
create index comps_zona_idx on comps (link_zona);
create index comps_sale_date_idx on comps (sale_date desc);
create unique index comps_listing_id_uniq on comps (listing_id) where listing_id is not null;

-- ---- valuation_requests (0007, 0014, 0015, 0019, 0020, 0026) ----
create table valuation_requests (
  id                        uuid primary key default gen_random_uuid(),
  reference_id              text not null unique,
  lead_id                   uuid not null references leads (id) on delete cascade,
  property_type             property_type_enum not null,
  superficie_mq             numeric(8, 2) not null,
  stanze                    integer,
  ascensore                 boolean not null default false,
  has_balcone               boolean not null default false,
  has_garage                boolean not null default false,
  has_giardino              boolean not null default false,
  condizioni                condizioni_enum not null,
  anni_ristrutturazione     text check (anni_ristrutturazione in ('<5', '5-10', '>10')),
  piano                     integer,
  piano_label               text check (piano_label in ('terra', 'rialzato', 'seminterrato', 'interrato')),
  piani_edificio            integer,
  riscaldamento             riscaldamento_enum,
  classe_energetica         text,
  address_raw               text not null,
  address_normalized        text,
  comune                    text,
  cap                       text,
  lat                       double precision,
  lng                       double precision,
  geom                      geometry(Point, 4326),
  superficie_commerciale_mq numeric(8, 2),
  zona_omi_id               text,
  fallback_level            fallback_level_enum not null default 'none',
  omi_eur_mq_min            numeric(10, 2),
  omi_eur_mq_max            numeric(10, 2),
  coefficients_applied      jsonb not null default '{}',
  estimate_min              numeric(12, 2),
  estimate_max              numeric(12, 2),
  confidence_score          integer,
  confidence_label          text check (confidence_label in ('Alta', 'Media', 'Bassa')),
  confidence_fsd            numeric(6, 4),
  breakdown                 jsonb not null default '[]',
  comparables               jsonb not null default '[]'::jsonb,
  narrative                 jsonb,
  catasto                   jsonb,
  document_facts            jsonb,
  documenti_status          text check (documenti_status in ('none', 'processing', 'reconciled')),
  perizia                   jsonb,
  zone_intelligence         jsonb,
  correction                jsonb,
  estimate_deterministic_min numeric(12, 2),
  estimate_deterministic_max numeric(12, 2),
  agent_final_value         numeric(12, 2),
  agent_notes               text,
  valuation_status          valuation_status_enum not null default 'pending',
  completed_at              timestamptz,
  input_hash                text not null unique,
  coefficient_set_id        uuid references coefficient_sets (id),
  model_version             integer not null default 1,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index valuation_requests_lead_idx on valuation_requests (lead_id);
create index valuation_requests_geom_gix on valuation_requests using gist (geom);
create index valuation_requests_status_idx on valuation_requests (valuation_status, created_at desc);

-- ---- valuation_overrides (0016) ----
create table valuation_overrides (
  id                 uuid primary key default gen_random_uuid(),
  reference_id       text not null,
  zona_omi_id        text,
  ai_estimate_min    numeric(12, 2),
  ai_estimate_max    numeric(12, 2),
  agent_final_value  numeric(12, 2) not null,
  delta_eur          numeric(12, 2),
  delta_pct          numeric(6, 4),
  agent_notes        text,
  coefficient_set_id uuid references coefficient_sets (id),
  model_version      integer not null default 1,
  recorded_at        timestamptz not null default now()
);
create index valuation_overrides_ref_idx on valuation_overrides (reference_id);
create index valuation_overrides_zona_idx on valuation_overrides (zona_omi_id);
create index valuation_overrides_recorded_at_idx on valuation_overrides (recorded_at desc);

-- ---- valuation_documents (0018) ----
create table valuation_documents (
  id            uuid primary key default gen_random_uuid(),
  reference_id  text not null,
  kind          text not null check (kind in ('planimetria', 'ape', 'nota_vocale')),
  storage_path  text not null,
  mime          text,
  byte_size     bigint,
  uploaded_by   text not null default 'agent' check (uploaded_by in ('seller', 'agent')),
  status        text not null default 'uploaded'
                  check (status in ('uploaded', 'processing', 'extracted', 'failed')),
  extraction    jsonb,
  transcript    text,
  error         text,
  attempts      integer not null default 0,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index valuation_documents_ref_idx on valuation_documents (reference_id);
create index valuation_documents_status_idx on valuation_documents (status, created_at desc);

-- ---- PostGIS Functions & RPCs (0009, 0011, 0022, 0024, 0025) ----

create or replace function omi_latest_semestre()
returns text language sql stable as $$
  select max(semestre) from omi_quotations;
$$;

create or replace function omi_zone_containing(
  p_lng double precision,
  p_lat double precision,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations language sql stable as $$
  select q.*
  from omi_quotations q
  where q.semestre = p_semestre
    and q.tipologia = p_tipologia
    and q.geom is not null
    and ST_Contains(q.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326));
$$;

create or replace function omi_zone_nearest(
  p_lng double precision,
  p_lat double precision,
  p_max_m double precision,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations language sql stable as $$
  with point as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) as g
  ),
  nearest as (
    select q.link_zona
    from omi_quotations q, point p
    where q.semestre = p_semestre
      and q.tipologia = p_tipologia
      and q.geom is not null
      and ST_DWithin(q.geom::geography, p.g::geography, p_max_m)
    order by q.geom <-> p.g
    limit 1
  )
  select q.*
  from omi_quotations q
  join nearest n on q.link_zona = n.link_zona
  where q.semestre = p_semestre
    and q.tipologia = p_tipologia;
$$;

create or replace function omi_comune_rows(
  p_comune_code text,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations language sql stable as $$
  select q.*
  from omi_quotations q
  where q.comune_code = p_comune_code
    and q.semestre = p_semestre
    and q.tipologia = p_tipologia;
$$;

create or replace function omi_upsert_quotations(p_rows jsonb)
returns integer language plpgsql as $$
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

create or replace function create_valuation_request(p_lead jsonb, p_request jsonb)
returns json language plpgsql as $$
declare
  v_hash    text := p_request->>'input_hash';
  v_ref     text;
  v_lead_id uuid;
  v_lat     double precision := nullif(p_request->>'lat', '')::double precision;
  v_lng     double precision := nullif(p_request->>'lng', '')::double precision;
  v_geom    geometry := null;
begin
  select reference_id into v_ref from valuation_requests where input_hash = v_hash;
  if found then
    return json_build_object('reference_id', v_ref, 'created', false);
  end if;

  if v_lat is not null and v_lng is not null then
    v_geom := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326);
  end if;

  begin
    insert into leads (
      nome, cognome, email, telefono, consent_privacy, consent_marketing, intent, is_priority
    )
    values (
      p_lead->>'nome', p_lead->>'cognome', p_lead->>'email', nullif(p_lead->>'telefono', ''),
      (p_lead->>'consent_privacy')::boolean, (p_lead->>'consent_marketing')::boolean,
      (p_lead->>'intent')::intent_enum, (p_lead->>'is_priority')::boolean
    )
    returning id into v_lead_id;

    insert into valuation_requests (
      reference_id, lead_id, property_type, superficie_mq, stanze, ascensore,
      has_balcone, has_garage, has_giardino, condizioni, anni_ristrutturazione,
      piano, piano_label, piani_edificio, riscaldamento, classe_energetica,
      address_raw, address_normalized, comune, cap, lat, lng, geom,
      input_hash, coefficient_set_id, model_version, valuation_status
    )
    values (
      p_request->>'reference_id', v_lead_id, (p_request->>'property_type')::property_type_enum,
      (p_request->>'superficie_mq')::numeric, nullif(p_request->>'stanze', '')::integer,
      (p_request->>'ascensore')::boolean,
      (p_request->>'has_balcone')::boolean, (p_request->>'has_garage')::boolean,
      (p_request->>'has_giardino')::boolean,
      (p_request->>'condizioni')::condizioni_enum, p_request->>'anni_ristrutturazione',
      nullif(p_request->>'piano', '')::integer, p_request->>'piano_label',
      nullif(p_request->>'piani_edificio', '')::integer,
      nullif(p_request->>'riscaldamento', '')::riscaldamento_enum, p_request->>'classe_energetica',
      p_request->>'address_raw', p_request->>'address_normalized', p_request->>'comune', p_request->>'cap',
      v_lat, v_lng, v_geom,
      v_hash, nullif(p_request->>'coefficient_set_id', '')::uuid,
      (p_request->>'model_version')::integer, 'pending'
    )
    returning reference_id into v_ref;

    return json_build_object('reference_id', v_ref, 'created', true);

  exception when unique_violation then
    select reference_id into v_ref from valuation_requests where input_hash = v_hash;
    return json_build_object('reference_id', v_ref, 'created', false);
  end;
end;
$$;

create or replace function comps_upsert(p_rows jsonb)
returns integer language plpgsql as $$
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
) language sql stable as $$
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

-- ---- Row Level Security & Policies (0012, 0016, 0018, 0021) ----

alter table leads enable row level security;
alter table valuation_requests enable row level security;
alter table valuation_overrides enable row level security;
alter table valuation_documents enable row level security;
alter table omi_quotations enable row level security;
alter table coefficient_sets enable row level security;
alter table comps enable row level security;

create policy agents_select_leads on leads for select to authenticated using (true);
create policy agents_select_requests on valuation_requests for select to authenticated using (true);
create policy agents_update_requests on valuation_requests for update to authenticated using (true) with check (true);
create policy overrides_select_authenticated on valuation_overrides for select to authenticated using (true);
create policy documents_select_authenticated on valuation_documents for select to authenticated using (true);

-- ---- Trigger Guard per Aggiornamenti Agente (0026 / 0027) ----
create or replace function enforce_agent_update_columns()
returns trigger language plpgsql as $$
begin
  if current_role is distinct from 'authenticated' then
    return new;
  end if;

  if (
    to_jsonb(new) - '{agent_final_value, agent_notes, valuation_status, completed_at}'::text[]
    is distinct from
    to_jsonb(old) - '{agent_final_value, agent_notes, valuation_status, completed_at}'::text[]
  ) then
    raise exception 'Gli agenti possono aggiornare solo agent_final_value, agent_notes, valuation_status, completed_at';
  end if;

  return new;
end;
$$;

create or replace trigger trg_enforce_agent_update_columns
  before update on valuation_requests
  for each row execute function enforce_agent_update_columns();
