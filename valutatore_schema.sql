-- =============================================================================
-- valutatore_schema.sql — BASELINE consolidata dello schema
-- =============================================================================
-- Questo file è la vista consolidata, in singolo file, dello schema. La SORGENTE
-- DI VERITÀ per l'applicazione incrementale sono le migrazioni versionate in
-- /supabase/migrations/0001..0008. Tenere i due allineati: ogni nuova migrazione
-- va riflessa qui. Generato per la Fase 1 (M1).
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

-- ---- comps (0006) — vuota in Fase 1 ----
create table comps (
  id                        uuid primary key default gen_random_uuid(),
  source                    text not null default 'agency',
  subject_geom              geometry(Point, 4326),
  comune_code               text,
  link_zona                 text,
  property_type             property_type_enum,
  superficie_mq             numeric(8, 2),
  superficie_commerciale_mq numeric(8, 2),
  stato                     omi_stato_enum,
  price                     numeric(12, 2) not null,
  sale_date                 date not null,
  attributes                jsonb not null default '{}',
  created_at                timestamptz not null default now()
);
create index comps_geom_gix on comps using gist (subject_geom);
create index comps_zona_idx on comps (link_zona);
create index comps_sale_date_idx on comps (sale_date desc);

-- ---- valuation_requests (0007) ----
create table valuation_requests (
  id            uuid primary key default gen_random_uuid(),
  reference_id  text not null unique,
  lead_id       uuid not null references leads (id) on delete cascade,
  property_type         property_type_enum not null,
  superficie_mq         numeric(8, 2) not null,
  stanze                integer,
  ascensore             boolean not null default false,
  has_balcone           boolean not null default false,
  has_garage            boolean not null default false,
  has_giardino          boolean not null default false,
  condizioni            condizioni_enum not null,
  anni_ristrutturazione text check (anni_ristrutturazione in ('<5', '5-10', '>10')),
  piano                 integer,
  piano_label           text check (piano_label in ('terra', 'rialzato', 'seminterrato', 'interrato')),
  piani_edificio        integer,
  riscaldamento         riscaldamento_enum,
  classe_energetica     text,
  address_raw        text not null,
  address_normalized text,
  comune             text,
  cap                text,
  lat                double precision,
  lng                double precision,
  geom               geometry(Point, 4326),
  superficie_commerciale_mq numeric(8, 2),
  zona_omi_id          text,
  fallback_level       fallback_level_enum not null default 'none',
  omi_eur_mq_min       numeric(10, 2),
  omi_eur_mq_max       numeric(10, 2),
  coefficients_applied jsonb not null default '{}',
  estimate_min         numeric(12, 2),
  estimate_max         numeric(12, 2),
  confidence_score     integer,
  confidence_label     text check (confidence_label in ('Alta', 'Media', 'Bassa')),
  confidence_fsd       numeric(6, 4),
  breakdown            jsonb not null default '[]',
  agent_final_value numeric(12, 2),
  agent_notes       text,
  valuation_status  valuation_status_enum not null default 'pending',
  completed_at      timestamptz,
  input_hash         text not null unique,
  coefficient_set_id uuid references coefficient_sets (id),
  model_version      integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index valuation_requests_lead_idx on valuation_requests (lead_id);
create index valuation_requests_geom_gix on valuation_requests using gist (geom);
create index valuation_requests_status_idx on valuation_requests (valuation_status, created_at desc);

-- ---- seed default coefficient_set (0008): vedi la migrazione per i valori ----
