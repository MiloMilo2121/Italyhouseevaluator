-- 0014_valuation_comparables.sql
-- V2: persiste la griglia di omogeneizzazione (comparabili usati) sulla
-- valuation_request, così il report nella dashboard la mostra. Aggiorna il
-- trigger di scope agente (0012) includendo `comparables` tra le colonne
-- protette (scrivibile solo da service_role in fase di enrichment).

alter table valuation_requests add column if not exists comparables jsonb not null default '[]';

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
    old.confidence_fsd, old.breakdown, old.comparables, old.input_hash,
    old.coefficient_set_id, old.model_version, old.created_at
  ) is distinct from (
    new.id, new.reference_id, new.lead_id, new.property_type, new.superficie_mq,
    new.stanze, new.ascensore, new.has_balcone, new.has_garage, new.has_giardino,
    new.condizioni, new.anni_ristrutturazione, new.piano, new.piano_label,
    new.piani_edificio, new.riscaldamento, new.classe_energetica,
    new.address_raw, new.address_normalized, new.comune, new.cap, new.lat, new.lng,
    new.geom::text, new.superficie_commerciale_mq, new.zona_omi_id, new.fallback_level,
    new.omi_eur_mq_min, new.omi_eur_mq_max, new.coefficients_applied,
    new.estimate_min, new.estimate_max, new.confidence_score, new.confidence_label,
    new.confidence_fsd, new.breakdown, new.comparables, new.input_hash,
    new.coefficient_set_id, new.model_version, new.created_at
  ) then
    raise exception 'Gli agenti possono aggiornare solo agent_final_value, agent_notes, valuation_status, completed_at';
  end if;

  return new;
end;
$$;
