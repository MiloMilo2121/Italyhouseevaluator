-- 0005_omi_quotations.sql
-- Dati di riferimento OMI (Agenzia delle Entrate). Storicizzati per semestre:
-- l'ingestion fa append per semestre (niente UPDATE distruttivi); la riga più
-- recente si sceglie a query time con max(semestre). Il PostGIS serve SOLO per
-- la risoluzione spaziale (point-in-polygon, nearest): nessuna business logic.

create table omi_quotations (
  id          uuid primary key default gen_random_uuid(),
  link_zona   text not null,                          -- chiave zona OMI (join VALORI<->ZONE)
  comune_amm  text,                                   -- denominazione comune
  comune_code text not null,                          -- codice Belfiore (catastale)
  fascia      fascia_enum not null,
  tipologia   text not null,                          -- es. 'Abitazioni civili'
  stato       omi_stato_enum not null,
  compr_min   numeric(10, 2) not null,                -- €/mq acquisto min
  compr_max   numeric(10, 2) not null,                -- €/mq acquisto max
  loc_min     numeric(10, 2),                         -- €/mq/mese locazione min (nullable: ~10% = 0/no dato)
  loc_max     numeric(10, 2),
  semestre    text not null,                          -- 'YYYY-S', es. '2024-2'
  geom        geometry(MultiPolygon, 4326),           -- perimetro zona (nullable per righe comune-only)
  created_at  timestamptz not null default now(),
  -- Upsert idempotente per chiave (link_zona, semestre, tipologia, stato).
  constraint omi_quotations_uniq unique (link_zona, semestre, tipologia, stato)
);

create index omi_quotations_geom_gix on omi_quotations using gist (geom);
create index omi_quotations_comune_idx on omi_quotations (comune_code, semestre);
create index omi_quotations_zona_idx on omi_quotations (link_zona, semestre);
