-- 0003_coefficient_sets.sql
-- Configurazione versionata dei coefficienti del motore di valutazione.
-- La logica TS legge SEMPRE il set attivo, passato come parametro.
--
-- INVARIANTE (append-only / immutabilità): un coefficient_set NON si modifica
-- mai in-place. Per ricalibrare se ne crea uno NUOVO (version+1) e si sposta il
-- flag `active`. Questo garantisce che l'`input_hash` delle valutazioni (che
-- include id+version del set) resti coerente nel tempo e che non si servano
-- stime "stale". L'indice unique parziale impone un solo set attivo.

create table coefficient_sets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  version            integer not null,
  active             boolean not null default false,
  superficie_weights jsonb not null,   -- coefficienti di ragguaglio superficie (§6.1)
  merit_coefficients jsonb not null,   -- piano/ascensore/classe/stato/range (§6.4, §6.7)
  created_at         timestamptz not null default now(),
  unique (name, version)
);

-- Esattamente un set attivo a livello DB.
create unique index coefficient_sets_one_active
  on coefficient_sets (active)
  where (active = true);
