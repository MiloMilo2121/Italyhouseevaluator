-- 0004_leads.sql
-- Lead = identità, contatti, consensi, intento. Scritto (committed) PRIMA
-- dell'enrichment: se geocoding/OMI/email falliscono, il lead è già salvato.

create table leads (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  cognome           text not null,
  email             text not null,
  telefono          text,
  consent_privacy   boolean not null,            -- deve essere true a livello applicativo
  consent_marketing boolean not null default false,
  intent            intent_enum not null,
  -- Derivato in TS (testabile): intent in ('vendere_ora','comprare_ora').
  is_priority       boolean not null default false,
  status            lead_status_enum not null default 'new',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index leads_email_idx on leads (lower(email));
create index leads_created_at_idx on leads (created_at desc);
