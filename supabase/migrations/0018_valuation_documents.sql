-- 0018_valuation_documents.sql
-- V2 Step 3 (Filone 2): metadati dei documenti caricati + stato del job di
-- estrazione. È un DATO DI SISTEMA (come valuation_overrides 0016): lo scrivono
-- solo le route con il service role. Lo `status` È la macchina a stati del job
-- (niente tabella job separata): uploaded → processing → extracted | failed.
-- Link "soft" a reference_id (no FK): il documento sopravvive a operazioni sulla
-- richiesta e l'upload del funnel arriva prima che la richiesta sia "completa".

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
  extraction    jsonb,                          -- fatti tipizzati estratti (vision/catasto)
  transcript    text,                           -- trascrizione (note vocali)
  error         text,
  attempts      integer not null default 0,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create index valuation_documents_ref_idx on valuation_documents (reference_id);
create index valuation_documents_status_idx on valuation_documents (status, created_at desc);

-- RLS come 0016: gli agenti POSSONO leggere (trasparenza in dashboard), ma NON
-- scrivere. Nessuna policy INSERT/UPDATE/DELETE ⇒ negate al ruolo
-- 'authenticated'; il service_role bypassa la RLS e resta l'unico a scrivere.
alter table valuation_documents enable row level security;

create policy documents_select_authenticated
  on valuation_documents for select to authenticated using (true);
