-- 0009_omi_spatial_functions.sql
-- Primitive di RISOLUZIONE SPAZIALE / recupero candidati OMI. Queste funzioni
-- fanno SOLO ciò in cui PostGIS è imbattibile (ST_Contains, KNN <->, filtro per
-- comune). NESSUNA business logic: la fallback ladder e ogni decisione vivono
-- nel resolver TypeScript (lib/omi/resolver.ts). Ritornano righe grezze.

-- Semestre più recente ingerito.
create or replace function omi_latest_semestre()
returns text
language sql
stable
as $$
  select max(semestre) from omi_quotations;
$$;

-- Zona che CONTIENE il punto: tutte le righe (per stato) della zona la cui
-- geometria contiene (lng, lat), per il semestre e la tipologia dati.
create or replace function omi_zone_containing(
  p_lng double precision,
  p_lat double precision,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations
language sql
stable
as $$
  select q.*
  from omi_quotations q
  where q.semestre = p_semestre
    and q.tipologia = p_tipologia
    and q.geom is not null
    and ST_Contains(q.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326));
$$;

-- Zona più VICINA entro p_max_m metri (KNN <-> sull'indice GIST), poi tutte le
-- sue righe per stato. Usa geography per la distanza in metri.
create or replace function omi_zone_nearest(
  p_lng double precision,
  p_lat double precision,
  p_max_m double precision,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations
language sql
stable
as $$
  with point as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) as g
  ),
  nearest as (
    select q.link_zona
    from omi_quotations q, point p
    where q.semestre = p_semestre
      and q.tipologia = p_tipologia
      and q.geom is not null
      and ST_DWithin(q.geom::geography, p.g::geography, p_max_m)
    order by q.geom <-> p.g
    limit 1
  )
  select q.*
  from omi_quotations q
  join nearest n on q.link_zona = n.link_zona
  where q.semestre = p_semestre
    and q.tipologia = p_tipologia;
$$;

-- Righe a livello comune (tutte le zone del comune), per il fallback comune.
-- L'aggregazione per stato è fatta in TypeScript (no logica in SQL).
create or replace function omi_comune_rows(
  p_comune_code text,
  p_semestre text,
  p_tipologia text
)
returns setof omi_quotations
language sql
stable
as $$
  select q.*
  from omi_quotations q
  where q.comune_code = p_comune_code
    and q.semestre = p_semestre
    and q.tipologia = p_tipologia;
$$;
