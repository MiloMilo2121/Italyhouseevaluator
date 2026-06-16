-- 0007_valuation_requests.sql
-- Richiesta di valutazione: attributi immobile + geo + campi intelligence
-- pre-calcolati (EnrichResult §6.8) + output agente (flywheel). Scritta
-- (committed) con status='pending' PRIMA dell'enrichment.

create table valuation_requests (
  id            uuid primary key default gen_random_uuid(),
  reference_id  text not null unique,                       -- id condivisibile, derivato dall'hash (VAL-XXXXXXXX)
  lead_id       uuid not null references leads (id) on delete cascade,

  -- ---- attributi immobile (contratto API §9) ----
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

  -- ---- geo ----
  address_raw        text not null,
  address_normalized text,
  comune             text,
  cap                text,
  lat                double precision,
  lng                double precision,
  geom               geometry(Point, 4326),

  -- ---- intelligence pre-calcolata (EnrichResult §6.8) ----
  superficie_commerciale_mq numeric(8, 2),
  zona_omi_id          text,                                 -- soft link (omi storicizzata)
  fallback_level       fallback_level_enum not null default 'none',
  omi_eur_mq_min       numeric(10, 2),
  omi_eur_mq_max       numeric(10, 2),
  coefficients_applied jsonb not null default '{}',
  estimate_min         numeric(12, 2),
  estimate_max         numeric(12, 2),
  confidence_score     integer,                              -- 0..100
  confidence_label     text check (confidence_label in ('Alta', 'Media', 'Bassa')),
  confidence_fsd       numeric(6, 4),
  breakdown            jsonb not null default '[]',

  -- ---- output agente (flywheel) ----
  agent_final_value numeric(12, 2),
  agent_notes       text,
  valuation_status  valuation_status_enum not null default 'pending',
  completed_at      timestamptz,

  -- ---- idempotenza + provenienza ----
  -- input_hash = SHA-256 di (snapshot input canonicalizzato + email lead +
  -- coefficient_set id/version + model_version). UNIQUE: un doppio submit
  -- concorrente non crea duplicati (la route usa ON CONFLICT DO NOTHING +
  -- re-select per ritornare il reference_id esistente).
  input_hash         text not null unique,
  coefficient_set_id uuid references coefficient_sets (id),
  model_version      integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index valuation_requests_lead_idx on valuation_requests (lead_id);
create index valuation_requests_geom_gix on valuation_requests using gist (geom);
create index valuation_requests_status_idx on valuation_requests (valuation_status, created_at desc);
