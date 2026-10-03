-- 0027_enforce_agent_update_columns_jsonb.sql
-- Refactoring architetturale del trigger guard: sostituzione della tupla statica
-- di 50 colonne con il diff JSONB invertito. In questo modo il guard è a prova di
-- future colonne (qualunque colonna aggiunta a valuation_requests viene automaticamente
-- protetta senza dover aggiornare manualmente una mega-tupla).
-- Solo le colonne whitelistate possono essere modificate dal ruolo authenticated.

create or replace function enforce_agent_update_columns()
returns trigger
language plpgsql
as $$
begin
  if current_role is distinct from 'authenticated' then
    return new; -- service_role / postgres: nessun vincolo
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
