-- 0026_valuation_zone_correction.sql
-- Fase 3/4: contesto zona (ricerca web) + correzione LLM tracciata + valore
-- deterministico pre-correzione (audit). Campi di SISTEMA scritti dal service
-- role nell'enrichment: vanno protetti nel guard del finalize agente.

alter table valuation_requests add column zone_intelligence jsonb;
alter table valuation_requests add column correction jsonb;
alter table valuation_requests add column estimate_deterministic_min numeric(12, 2);
alter table valuation_requests add column estimate_deterministic_max numeric(12, 2);

-- Ricreo il guard (corpo di 0020) aggiungendo i 4 nuovi campi alle tuple.
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
    old.confidence_fsd, old.breakdown, old.narrative, old.comparables,
    old.catasto, old.document_facts, old.documenti_status, old.perizia,
    old.zone_intelligence, old.correction,
    old.estimate_deterministic_min, old.estimate_deterministic_max,
    old.input_hash, old.coefficient_set_id, old.model_version, old.created_at
  ) is distinct from (
    new.id, new.reference_id, new.lead_id, new.property_type, new.superficie_mq,
    new.stanze, new.ascensore, new.has_balcone, new.has_garage, new.has_giardino,
    new.condizioni, new.anni_ristrutturazione, new.piano, new.piano_label,
    new.piani_edificio, new.riscaldamento, new.classe_energetica,
    new.address_raw, new.address_normalized, new.comune, new.cap, new.lat, new.lng,
    new.geom::text, new.superficie_commerciale_mq, new.zona_omi_id, new.fallback_level,
    new.omi_eur_mq_min, new.omi_eur_mq_max, new.coefficients_applied,
    new.estimate_min, new.estimate_max, new.confidence_score, new.confidence_label,
    new.confidence_fsd, new.breakdown, new.narrative, new.comparables,
    new.catasto, new.document_facts, new.documenti_status, new.perizia,
    new.zone_intelligence, new.correction,
    new.estimate_deterministic_min, new.estimate_deterministic_max,
    new.input_hash, new.coefficient_set_id, new.model_version, new.created_at
  ) then
    raise exception 'Gli agenti possono aggiornare solo agent_final_value, agent_notes, valuation_status, completed_at';
  end if;

  return new;
end;
$$;
