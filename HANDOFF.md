# HANDOFF — Continuare il Valutatore Immobiliare (stato deploy)

> Documento operativo per riprendere il lavoro in un altro ambiente (locale o cloud).
> Il **backend è già stato provisionato**: NON ricreare il progetto Supabase, NON
> riapplicare migrazioni, NON ricreare l'utente agente — è tutto già fatto.

## ⚠️ Segreti — NON sono in questo file (repo pubblico)
- `SUPABASE_SERVICE_ROLE_KEY` → prendila dal dashboard (link sotto), è segreta.
- Password utente agente → fornita in chat; in alternativa reimpostala dal dashboard.
- Non committare MAI service_role key, password, o `ANTHROPIC_API_KEY` (il `.env.local` è gitignored).

---

## Stato attuale

| Risorsa | Valore | Stato |
|---|---|---|
| Progetto Supabase | `valutatore-delfino` — ref `pdepjngksvgxpciflaig` (EU Frankfurt) | ✅ attivo |
| Migrazioni DB | 21 (`0001`→`0021`: schema, RLS, RPC, trigger, seed, perizia) | ✅ applicate |
| Coefficient set | `default v1` (seed `0008`) | ✅ caricato |
| Utente agente | email `marco.milamelo@gmail.com` (password in chat) | ✅ creato |
| Codice GitHub | branch `main` e `claude/loving-shannon-vqi7in` | ✅ allineati |

Dashboard API keys (per `service_role`):
https://supabase.com/dashboard/project/pdepjngksvgxpciflaig/settings/api-keys

---

## FASE 0 — Aggiorna il repo (non riclonare)

```bash
git fetch origin
git pull origin main          # fast-forward, nessun conflitto
git log --oneline -3
```

## FASE 1 — `.env.local` (root del progetto, gitignored)

```bash
# SUPABASE — backend GIÀ provisionato, NON ricreare
NEXT_PUBLIC_SUPABASE_URL=https://pdepjngksvgxpciflaig.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZXBqbmdrc3ZneHBjaWZsYWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzQ0NDIsImV4cCI6MjA5NzM1MDQ0Mn0.bUdqGrAeMorjUvlUqqQhoP8_ZFJFfm0yejL_-rSR49s

# SEGRETA — prendila dal dashboard (link sopra), riga `service_role` → Reveal
SUPABASE_SERVICE_ROLE_KEY=

# GEOCODING — Nominatim: gratis, reale, nessuna chiave
GEOCODING_PROVIDER=nominatim

# MOTORE
VALUATION_MODEL_VERSION=1

# OPZIONALI (scommenta per attivare)
# ANTHROPIC_API_KEY=sk-ant-...     # narrazione + perizia + vision + reconciler
# GOOGLE_PLACES_API_KEY=...        # geocoding premium (poi GEOCODING_PROVIDER=google)
# RESEND_API_KEY=...               # email
# EMAIL_FROM=Delfino <no-reply@tuodominio.it>
# AGENT_NOTIFICATION_EMAIL=tua@email.it
```

> `anon` key = pubblica (sta nel browser, protetta dalla RLS). `service_role` = bypassa
> la RLS, usata solo dal server. Mai nel browser, mai su git.

## FASE 2 — Installa, verifica, avvia

```bash
npm install            # USA npm (c'è package-lock.json), NON pnpm/yarn
npm run typecheck      # 0 errori
npm test               # 192 test verdi
npm run build          # build OK
npm run dev            # http://localhost:3000
```

Requisiti: **Node 20 LTS** (≥18.18). NON serve Docker né `supabase start`: il DB è hosted.

## FASE 3 — Prova end-to-end

- Funnel: `http://localhost:3000/valutazione` → compila → ottieni `reference_id` (VAL-XXXXXXXX).
- Dashboard: `http://localhost:3000/agenti` → login agente → apri il dettaglio → **Finalizza**
  (inserisci il valore reale → parte il flywheel).
- Senza OMI ingerite la stima è in `prior_only` (normale finché non fai FASE 5).

## FASE 4 — Deploy Vercel (online)

1. https://vercel.com/new → Import `MiloMilo2121/Italyhouseevaluator`.
2. Framework Next.js (auto), Root `./`, build default.
3. Environment Variables = le stesse del `.env.local` (incl. `service_role`).
4. Deploy.

Note:
- Production branch = `main` (impostalo come default su GitHub, o in Vercel → Settings → Git).
- La perizia (`maxDuration=120s`) supera il limite Hobby (60s) → per la perizia live serve **Pro**.

## FASE 5 — Dati OMI (numeri reali)

I file OMI sono gated da SPID (Agenzia Entrate, geopoi.agenziaentrate.gov.it):
scarica per semestre `VALORI` csv, `ZONE` csv, perimetri `KML` → mettili in `data/omi/`.

```bash
# dry-run (nessuna scrittura)
npm run ingest:omi -- --dry-run --semestre 2024-2 \
  --valori data/omi/valori.csv --zone data/omi/zone.csv --kml data/omi/zone.kml

# ingestione reale (upsert idempotente, usa la service_role dalle env)
npm run ingest:omi -- --semestre 2024-2 \
  --valori data/omi/valori.csv --zone data/omi/zone.csv --kml data/omi/zone.kml
```

## FASE 6 — Feature LLM

Aggiungi `ANTHROPIC_API_KEY` (a `.env.local` e a Vercel) → in dashboard compaiono i bottoni
"Genera relazione" e "Genera perizia". Senza key, l'app degrada pulita (solo numeri).
Principio cardine: i numeri li calcola il motore deterministico; l'LLM scrive solo la prosa.

---

## Troubleshooting

| Sintomo | Causa | Fix |
|---|---|---|
| `Configurazione env non valida` | manca una env required | controlla URL/anon/service_role |
| Login agente fallisce | env Supabase errate | verifica URL+anon (l'utente esiste già) |
| Autocomplete vuoto | rate-limit Nominatim / query <3 char | riprova; per volumi usa Google Places |
| Stime sempre `prior_only` | OMI non ingerite | fai FASE 5 |
| Perizia va in timeout | piano Vercel Hobby (60s) | usa Pro o testa in locale |

## Checklist

```
[ ] git pull origin main
[ ] .env.local + service_role key
[ ] npm install && npm test
[ ] npm run dev → prova funnel + dashboard
[ ] deploy Vercel + env
[ ] (numeri reali) ingest OMI
[ ] (LLM) ANTHROPIC_API_KEY
```
