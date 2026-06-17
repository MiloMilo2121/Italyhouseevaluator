-- 0017_storage_documenti.sql
-- V2 Step 3 (Filone 2): bucket Storage per i documenti caricati (planimetrie,
-- APE, note vocali). Modello di accesso:
--   * Bucket PRIVATO (public=false): nessun URL pubblico.
--   * SCRITTURE: solo via route server con il service role (createServiceClient),
--     che bypassa la RLS di storage.objects. Il venditore (funnel, anonimo) e
--     l'agente caricano sempre passando per /api/documenti/upload — mai diretti.
--   * LETTURE: signed URL generati lato server (createSignedUrl), quindi NON
--     serve una policy SELECT su storage.objects. Il bucket resta default-deny.
-- Idempotente: on conflict do nothing (il bucket potrebbe già esistere).

insert into storage.buckets (id, name, public)
values ('documenti', 'documenti', false)
on conflict (id) do nothing;
