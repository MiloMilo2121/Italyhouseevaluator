-- 0019_valuation_documents_facts.sql
-- V2 Step 3 (Filone 2): fatti documentali riconciliati su valuation_requests.
--   * `catasto`        — risultato deterministico del lookup catastale.
--   * `document_facts` — esito della riconciliazione LLM: override applicati
--                        (con provenienza), dubbi segnalati all'agente, sintesi.
--   * `documenti_status` — stato coarse del pipeline doc (none|processing|reconciled).
-- Sono campi di SISTEMA (scritti dalla route /api/documenti/process col service
-- role): vanno aggiunti alle colonne PROTETTE del trigger così un agente
-- (ruolo 'authenticated') non può modificarli con l'update di finalize.
--
-- NB sul flywheel: dopo un re-enrich documentale, estimate_* riflette la stima
-- AI CORRETTA dai documenti; quindi il `delta_pct` registrato in
-- valuation_overrides (0016) alla chiusura misura il reale contro la migliore
-- stima AI (comportamento voluto: i fatti documentali migliorano la baseline).
--
-- Inoltre chiudo un gap PRE-ESISTENTE: `comparables` (aggiunta in 0014, scritta
-- da enrichResultToUpdate) non era nella lista protetta del trigger 0012/0015.

alter table valuation_requests add column catasto jsonb;
alter table valuation_requests add column document_facts jsonb;
alter table valuation_requests add column documenti_status text;

-- Ricreo il guard di colonna (corpo di 0015) aggiungendo alle tuple immutabili
-- `comparables`, `catasto`, `document_facts`, `documenti_status`.
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
    old.catasto, old.document_facts, old.documenti_status,
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
    new.catasto, new.document_facts, new.documenti_status,
    new.input_hash, new.coefficient_set_id, new.model_version, new.created_at
  ) then
    raise exception 'Gli agenti possono aggiornare solo agent_final_value, agent_notes, valuation_status, completed_at';
  end if;

  return new;
end;
$$;
