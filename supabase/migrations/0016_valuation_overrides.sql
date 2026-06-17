-- 0016_valuation_overrides.sql
-- Flywheel (V2 Step 2): log append-only dello scarto tra stima AI e valore
-- reale di chiusura inserito dall'agente. È un DATO DI SISTEMA: lo scrive solo
-- la route /api/agenti/finalize col service role (best-effort). Servirà per
-- ricalibrare i coefficienti del motore per zona/versione.
-- Link "soft" (no FK): il log sopravvive anche se la richiesta viene rimossa.

create table valuation_overrides (
  id                 uuid primary key default gen_random_uuid(),
  reference_id       text not null,
  zona_omi_id        text,
  ai_estimate_min    numeric(12, 2),
  ai_estimate_max    numeric(12, 2),
  ai_point           numeric(12, 2),
  agent_final_value  numeric(12, 2) not null,
  delta_pct          numeric(8, 5),               -- (reale − ai_point)/ai_point; null se nessuna stima AI
  agent_notes        text,
  coefficient_set_id uuid,
  model_version      integer not null default 1,
  created_at         timestamptz not null default now()
);

create index valuation_overrides_zona_idx on valuation_overrides (zona_omi_id);
create index valuation_overrides_created_idx on valuation_overrides (created_at desc);
create index valuation_overrides_ref_idx on valuation_overrides (reference_id);

-- RLS: gli agenti POSSONO leggere (trasparenza interna sul flywheel) ma NON
-- scrivere. Nessuna policy INSERT/UPDATE/DELETE ⇒ negate al ruolo
-- 'authenticated'. Il service_role bypassa la RLS e resta l'unico a scrivere.
alter table valuation_overrides enable row level security;

create policy overrides_select_authenticated
  on valuation_overrides for select to authenticated using (true);
