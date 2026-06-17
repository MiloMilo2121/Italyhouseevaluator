-- 0011_create_valuation_rpc.sql
-- Persistenza ATOMICA lead + valuation_request (committata PRIMA dell'enrichment,
-- §4). È SOLA PERSISTENZA (non business logic di valutazione): inserimento +
-- dedup + costruzione geometria. Idempotente su input_hash.
--
-- Pattern anti-orfani: il blocco BEGIN…EXCEPTION crea un savepoint implicito; se
-- l'insert della request viola l'unique su input_hash (doppio submit concorrente),
-- l'eccezione fa rollback dell'INTERO blocco — incluso il lead appena inserito —
-- e si ri-seleziona il vincitore. Nessun lead orfano, nessun doppione.

create or replace function create_valuation_request(p_lead jsonb, p_request jsonb)
returns json
language plpgsql
as $$
declare
  v_hash    text := p_request->>'input_hash';
  v_ref     text;
  v_lead_id uuid;
  v_lat     double precision := nullif(p_request->>'lat', '')::double precision;
  v_lng     double precision := nullif(p_request->>'lng', '')::double precision;
  v_geom    geometry := null;
begin
  -- Fast path: re-submit idempotente.
  select reference_id into v_ref from valuation_requests where input_hash = v_hash;
  if found then
    return json_build_object('reference_id', v_ref, 'created', false);
  end if;

  if v_lat is not null and v_lng is not null then
    v_geom := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326);
  end if;

  begin
    insert into leads (
      nome, cognome, email, telefono, consent_privacy, consent_marketing, intent, is_priority
    )
    values (
      p_lead->>'nome', p_lead->>'cognome', p_lead->>'email', nullif(p_lead->>'telefono', ''),
      (p_lead->>'consent_privacy')::boolean, (p_lead->>'consent_marketing')::boolean,
      (p_lead->>'intent')::intent_enum, (p_lead->>'is_priority')::boolean
    )
    returning id into v_lead_id;

    insert into valuation_requests (
      reference_id, lead_id, property_type, superficie_mq, stanze, ascensore,
      has_balcone, has_garage, has_giardino, condizioni, anni_ristrutturazione,
      piano, piano_label, piani_edificio, riscaldamento, classe_energetica,
      address_raw, address_normalized, comune, cap, lat, lng, geom,
      input_hash, coefficient_set_id, model_version, valuation_status
    )
    values (
      p_request->>'reference_id', v_lead_id, (p_request->>'property_type')::property_type_enum,
      (p_request->>'superficie_mq')::numeric, nullif(p_request->>'stanze', '')::integer,
      (p_request->>'ascensore')::boolean,
      (p_request->>'has_balcone')::boolean, (p_request->>'has_garage')::boolean,
      (p_request->>'has_giardino')::boolean,
      (p_request->>'condizioni')::condizioni_enum, p_request->>'anni_ristrutturazione',
      nullif(p_request->>'piano', '')::integer, p_request->>'piano_label',
      nullif(p_request->>'piani_edificio', '')::integer,
      nullif(p_request->>'riscaldamento', '')::riscaldamento_enum, p_request->>'classe_energetica',
      p_request->>'address_raw', p_request->>'address_normalized', p_request->>'comune', p_request->>'cap',
      v_lat, v_lng, v_geom,
      v_hash, nullif(p_request->>'coefficient_set_id', '')::uuid,
      (p_request->>'model_version')::integer, 'pending'
    )
    returning reference_id into v_ref;

    return json_build_object('reference_id', v_ref, 'created', true);

  exception when unique_violation then
    -- Race su input_hash/reference_id: rollback del blocco (lead incluso),
    -- poi ritorno il vincitore.
    select reference_id into v_ref from valuation_requests where input_hash = v_hash;
    return json_build_object('reference_id', v_ref, 'created', false);
  end;
end;
$$;
