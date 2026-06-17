-- 0012_rls_agents.sql
-- RLS per la dashboard agente (M6). L'API pubblica usa la service-role key
-- (bypassa RLS) ⇒ gli insert del funnel e l'update dell'enrichment restano
-- intatti. Gli agenti (ruolo 'authenticated', sessione cookie @supabase/ssr)
-- possono LEGGERE tutto e SCRIVERE solo i 4 campi di chiusura del flywheel.

alter table leads enable row level security;
alter table valuation_requests enable row level security;

-- SELECT: qualunque utente autenticato (Fase 1: nessun assegnatario per-agente).
create policy agents_select_leads
  on leads for select to authenticated using (true);
create policy agents_select_requests
  on valuation_requests for select to authenticated using (true);

-- UPDATE consentito agli autenticati; lo SCOPE di colonna è imposto dal trigger
-- (la RLS non può vincolare quali colonne cambiano). Niente policy INSERT/DELETE
-- ⇒ negati al ruolo authenticated. Il ruolo service_role bypassa la RLS.
create policy agents_update_requests
  on valuation_requests for update to authenticated
  using (true) with check (true);

-- Guard di colonna: un UPDATE dal ruolo 'authenticated' può toccare SOLO
-- agent_final_value, agent_notes, valuation_status, completed_at. Gli altri ruoli
-- (service_role, postgres) sono esenti.
create or replace function enforce_agent_update_columns()
returns trigger
language plpgsql
as $$
begin
  if current_role is distinct from 'authenticated' then
    return new; -- service_role / postgres: nessun vincolo
  end if;

  if (
    old.id, old.reference_id, old.lead_id, old.property_type, old.superficie_mq,
    old.stanze, old.ascensore, old.has_balcone, old.has_garage, old.has_giardino,
    old.condizioni, old.anni_ristrutturazione, old.piano, old.piano_label,
    old.piani_edificio, old.riscaldamento, old.classe_energetica,
    old.address_raw, old.address_normalized, old.comune, old.cap, old.lat, old.lng,
    old.geom::text, old.superficie_commerciale_mq, old.zona_omi_id, old.fallback_level,
    old.omi_eur_mq_min, old.omi_eur_mq_max, old.coefficients_applied,
    old.estimate_min, old.estimate_max, old.confidence_score, old.confidence_label,
    old.confidence_fsd, old.breakdown, old.input_hash, old.coefficient_set_id,
    old.model_version, old.created_at
  ) is distinct from (
    new.id, new.reference_id, new.lead_id, new.property_type, new.superficie_mq,
    new.stanze, new.ascensore, new.has_balcone, new.has_garage, new.has_giardino,
    new.condizioni, new.anni_ristrutturazione, new.piano, new.piano_label,
    new.piani_edificio, new.riscaldamento, new.classe_energetica,
    new.address_raw, new.address_normalized, new.comune, new.cap, new.lat, new.lng,
    new.geom::text, new.superficie_commerciale_mq, new.zona_omi_id, new.fallback_level,
    new.omi_eur_mq_min, new.omi_eur_mq_max, new.coefficients_applied,
    new.estimate_min, new.estimate_max, new.confidence_score, new.confidence_label,
    new.confidence_fsd, new.breakdown, new.input_hash, new.coefficient_set_id,
    new.model_version, new.created_at
  ) then
    raise exception 'Gli agenti possono aggiornare solo agent_final_value, agent_notes, valuation_status, completed_at';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_agent_update_columns
  before update on valuation_requests
  for each row execute function enforce_agent_update_columns();
