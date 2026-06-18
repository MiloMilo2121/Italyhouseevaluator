-- 0021_rls_internal_tables.sql
-- Hardening (security advisor): abilita RLS su omi_quotations, coefficient_sets,
-- comps. Sono tabelle INTERNE, lette/scritte SOLO via service-role
-- (createServiceClient, che bypassa la RLS): la route /api/valutazione costruisce
-- il client con createServiceClient(); loadActiveCoefficientSet, SupabaseOmiQueryClient
-- e SupabaseComparablesProvider ricevono quel client; l'ingestion (omi_upsert_quotations,
-- comps_upsert) gira da script/webhook col service-role. Nessun percorso anon/
-- authenticated le interroga.
--
-- Con RLS abilitata e NESSUNA policy: anon e authenticated sono negati di default,
-- il service_role resta esente. Allinea col principio del brief: i comparabili sono
-- input aggregato interno, mai esposti via API. (Le righe restano leggibili solo
-- lato server, dove servono al motore.)

alter table omi_quotations enable row level security;
alter table coefficient_sets enable row level security;
alter table comps enable row level security;
