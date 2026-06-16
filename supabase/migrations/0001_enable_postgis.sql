-- 0001_enable_postgis.sql
-- Estensioni richieste. PostGIS per le geometrie (point-in-polygon, KNN);
-- pgcrypto per gen_random_uuid(). DEVE essere la prima migrazione: le tabelle
-- con colonne geometry(...) dipendono da PostGIS.

create extension if not exists postgis;
create extension if not exists pgcrypto;
