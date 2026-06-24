# Valutatore Immobiliare Delfino

Valutatore immobiliare sincrono per un'agenzia italiana (Delfino Real Estate).
Un funnel conversazionale cattura lead-venditori promettendo una **valutazione
gratuita di un esperto entro 24h**; alla submission un **intelligence layer
nascosto** pre-calcola un range di valore + una scheda di valutazione e la invia
all'agente, che arriva all'appuntamento con la stima già all'80%.

L'output interno è **sempre un range + livello di confidenza**, mai un numero
secco, con un **breakdown voce-per-voce** per la spiegabilità.

Fonte dati di riferimento (Fase 1): **Agenzia delle Entrate – OMI**.

## Principi architetturali (non negoziabili)

1. **Sincrono e semplice**: una sola API route, solo servizi managed (Vercel +
   Supabase + Resend). Niente queue/worker/cron/VPS.
2. **Source-of-truth prima di tutto**: lead e richiesta committati su Postgres
   PRIMA dell'enrichment. Il fallimento dell'enrichment non perde mai il lead.
3. **Logica = TypeScript puro e testato**. PostGIS fa SOLO risoluzione spaziale
   e recupero candidati. Nessuna business logic in SQL/RPC.
4. **Mai un numero secco**: sempre range + confidenza.
5. **Spiegabilità by design**: breakdown voce-per-voce sempre presente.
6. **Privacy minimale**: due soli consensi (privacy obbligatorio, marketing
   opzionale). Nessuna cessione dati.
7. **Niente browser storage**: stato del funnel in memoria; persistenza solo su
   Supabase.

## Stack

- **Next.js 15** (App Router, TypeScript strict) — deploy su Vercel
- **Supabase** (Postgres + PostGIS) — unica source of truth
- **Resend** — email (scheda agente + conferma lead)
- **Zod** — validazione input
- **Vitest** — test

## Setup locale

```bash
npm install
cp .env.example .env.local   # poi compila i valori
```

Variabili in `.env.example`: URL/chiavi Supabase, chiave Resend, provider e
chiave geocoding, `VALUATION_MODEL_VERSION`.

## Database (Supabase + PostGIS)

Le migrazioni sono file SQL versionati in `supabase/migrations/0001..0026`
(append-only: non modificare una migrazione già spedita, aggiungerne una nuova).
La baseline consolidata in singolo file è `valutatore_schema.sql`.

> Stato DB (giugno 2026): OMI 2025-2 ingerito (nazionale), migrazioni fino a
> **0022** e **0026** applicate. Le **0023/0024/0025** (filtro tipologia +
> attributi comp) vanno applicate quando si attivano i comparabili (Apify).

Applicazione (Supabase CLI):

```bash
supabase link --project-ref <ref>
supabase db push        # applica le migrazioni
# oppure, in locale:
supabase start
supabase migration up
```

`0001` abilita PostGIS — deve girare per prima (le colonne `geometry(...)` ne
dipendono). Il set di coefficienti di default attivo è seedato da `0008`.

> Invariante: i `coefficient_sets` sono **immutabili**. Per ricalibrare si crea
> un nuovo set versionato e si sposta il flag `active`, mai modificandone uno
> esistente (l'`input_hash` delle valutazioni dipende da id+version del set).

## Dati OMI (ingestion)

I file OMI reali (gated da SPID/area riservata) vanno in `data/omi/`
(gitignored): `VALORI` csv, `ZONE` csv, perimetri `KML`.

Il formato reale dell'Agenzia Entrate fornisce `QI_<YYYYS>_VALORI.csv` +
`QI_<YYYYS>_ZONE.csv` (16 col) + **un KML per comune** (es. `A001.kml`). Il
flag `--kml-dir` itera la directory dei KML (la zona si identifica via
`CODCOM`+`CODZONA`); lo script carica `.env.local` da sé.

```bash
# dry-run: pipeline + report, senza scrivere su DB
npm run ingest:omi -- --dry-run --semestre 2025-2 \
  --valori "<dir>/QI_20252_VALORI.csv" --zone "<dir>/QI_20252_ZONE.csv" --kml-dir "<dir>"

# ingestion reale (upsert idempotente + resiliente su Supabase)
npm run ingest:omi -- --semestre 2025-2 \
  --valori "<dir>/QI_20252_VALORI.csv" --zone "<dir>/QI_20252_ZONE.csv" --kml-dir "<dir>"
```

La RPC `omi_upsert_quotations` (mig. 0022) fa `ST_SimplifyPreserveTopology` +
`ST_CollectionExtract` + `ST_Multi` (geometrie valide e leggere). L'upsert dello
script è **resiliente**: una geometria degenere o un timeout ripiega riga-per-riga
senza abortire.

La pipeline (`lib/omi/`) è pura e gestisce le insidie reali del formato:
separatore `;`, riga di didascalia iniziale, `;` finale spurio, decimali con
virgola italiana, encoding forzato UTF-8, locazione 0 → null, join
VALORI↔ZONE↔perimetri per `LinkZona`. **§8**: le intestazioni CSV sono validate
all'avvio e l'ingestion fallisce con un messaggio chiaro se il tracciato non
corrisponde (le costanti `EXPECTED_*_HEADERS` in `lib/omi/csv.ts` sono
adattabili per semestre).

Bug geometrici noti **gestiti senza crashare** (scartati/segnalati nel report):
poligoni mal-georeferenziati fuori dal bbox Italia (es. poligono sardo in
Africa), ring invalidi, e zone senza perimetro (gap tipo provincia di
Forlì-Cesena → riga senza geometria + flag `missing_geometry`).

Le geometrie vengono scritte via `omi_upsert_quotations` (migrazione 0010) che
applica `ST_GeomFromGeoJSON → SRID 4326 → ST_MakeValid`. La risoluzione zona usa
le funzioni spaziali della migrazione 0009 (`ST_Contains`, KNN `<->`) — solo
recupero candidati; la fallback ladder vive in `lib/omi/resolver.ts` (TS).

### Test d'integrazione spaziale (DB reale)

I test del motore girano senza DB; la risoluzione spaziale reale (PostGIS
`ST_Contains`) va validata a parte. Con un progetto Supabase di test (migrazioni
applicate, incl. 0009/0010):

```bash
OMI_TEST_SUPABASE_URL=... OMI_TEST_SUPABASE_SERVICE_KEY=... npm run test:integration
```

Senza quelle variabili la suite d'integrazione è saltata.

## Test

```bash
npm test            # Vitest, una volta
npm run test:watch
npm run test:coverage
npm run typecheck   # tsc --noEmit (strict)
npm run lint
```

I test del motore (`lib/valuation`) sono in TS puro con **fixture OMI** e un
**fake resolver** (ray-casting): **zero dipendenza dal DB**.

> ⚠️ I verdi dei test del motore NON validano la risoluzione spaziale reale: il
> fake resolver usa ray-casting, la produzione usa PostGIS `ST_Contains`
> (semantica diversa su bordi/multipolygon/buchi). La risoluzione zona reale si
> valida con `npm run test:integration` su un DB Supabase di test (vedi sotto).
> Da estendere con le geometrie reali e i bug noti (Forlì-Cesena, poligono
> sardo, punti esattamente sul confine).

## Layout

```
app/                       # Next.js App Router (funnel M5, dashboard /agenti M6)
lib/
  valuation/               # MOTORE (TS puro): surface, omi, coefficient(s),
                           #   range, confidence, hash, comparables (scaffold),
                           #   enrich (orchestratore), ports (seam iniettabile)
  schemas/                 # contratto Zod §9 + mapper
  api/                     # handleValuation (orchestratore route) + ports
  email/                   # template puri + sender Resend
  omi/                     # ingestion + resolver PostGIS (M3)
  geocoding/               # GeocodingProvider + impl (M5)
  db/                      # client Supabase + persistenza valuations/coeff
supabase/migrations/       # SQL versionato (baseline: valutatore_schema.sql)
scripts/ingest-omi.ts      # ingestion OMI (M3)
data/omi/                  # file OMI reali (gitignored)
test/                      # Vitest + fixtures
```

## Il motore di valutazione in breve

`enrich(subject, deps)` (orchestratore async, dipendenze iniettate, nessun
side-effect proprio):

1. **Superficie commerciale** = Σ(area × coeff. ragguaglio) (DPR 138).
2. **Risoluzione zona OMI** via port iniettabile (PostGIS in M3).
3. **Stato → riga OMI** (Ottimo/Normale/Scadente): lo stato seleziona la riga,
   non è un coefficiente (anti-double-counting).
4. **Coefficiente di merito** = prodotto dei soli fattori che OMI non cattura
   (piano/ascensore × classe energetica × luminosità × correttivo di stato).
5. **Stima base** = €/mq OMI × superficie × merito; box auto = valore a corpo.
6. **Confidenza** 0–100 → Alta/Media/Bassa (+ FSD placeholder).
7. **Range** accoppiato alla confidenza (più bassa ⇒ range più ampio).
8. **Comparabili** (scaffold Fase 2): shrinkage `α=n/(n+k)`; in Fase 1 `n=0` ⇒
   valore = prior OMI.

Output: range + confidenza + breakdown voce-per-voce (`EnrichResult`).

## API — `POST /api/valutazione` (§9)

Pipeline sincrona (`app/api/valutazione/route.ts` → `lib/api/handle-valuation.ts`):
Zod validate → **insert lead + request COMMITTED prima dell'enrichment** (RPC
transazionale `create_valuation_request`, atomica + dedup su `input_hash` +
costruzione `geom`) → `enrich` best-effort → update → email Resend (scheda agente
+ conferma lead) → `200 { reference_id }`.

Garanzie: enrich/email sono best-effort — un loro fallimento **non** fa fallire la
richiesta né perde il lead (mai 5xx per loro); re-submit idempotente (stesso input)
ritorna lo stesso `reference_id` senza ri-enrichare/ri-emailare. Senza
`RESEND_API_KEY` l'invio degrada a logging; senza OMI ingerito l'enrichment
degrada a `prior_only` ma la risposta resta 200. La logica è testata con fake
(`test/api-contract.test.ts`), zero DB/Resend.

## Funnel — `/valutazione` (§12)

State machine multi-step (`lib/funnel/`, **pura e testata**) cablata a `POST
/api/valutazione`. Raccoglie tutti i campi del contratto §9; branching
(condizioni→anni), SALTA sugli step opzionali, progress bar, modale exit-intent.
**Nessun valore mostrato all'utente** (solo conferma + `reference_id`). Stato solo
in React (no browser storage). Geocoding dietro `GeocodingProvider`
(`lib/geocoding/`, default Google, **fallback Mock senza chiave**) tramite il
proxy server-side `/api/geocoding` (la chiave non raggiunge il browser); mappa con
pin spostabile via Leaflet+OSM. Componente self-contained: la UI di produzione
in-brand (Claude Design) può sostituirlo consumando lo stesso contratto.

`toApiPayload` è coperto dal test keystone `test/funnel-payload.test.ts`
(l'output passa `ValuationRequestSchema`).

## Dashboard agente — `/agenti` (§11)

Area riservata (Supabase Auth via `@supabase/ssr`, cookie session) protetta dal
`middleware.ts` (redirect a `/agenti/login` se non autenticato; `getClaims()`).
Lista lead/valutazioni ordinata per priorità intent + data; dettaglio che riusa
la **stessa scheda dell'email agente** (`renderAgentCard`) + form per inserire il
**valore finale reale** (`agent_final_value`/`agent_notes` → `valuation_status='completed'`):
è la **chiusura del flywheel**, i dati reali per ricalibrare il modello.

Sicurezza: **RLS** (migrazione 0012) — l'API pubblica usa la service-role key
(bypassa RLS, insert del funnel intatti); gli agenti (`authenticated`) leggono
tutto e, via trigger di colonna, possono scrivere **solo** i 4 campi di chiusura.
La logica (`lib/agenti/finalize.ts`, `list.ts`, `card.ts`) è pura e testata; per
usarla davvero serve un progetto Supabase con un utente agente creato in Auth e
le migrazioni applicate (l'allow/deny RLS reale si valida su ambiente deployato).

## V2 (Step 1) — Comparabili MCA + report spiegabile

Salto oltre il deterministico OMI, **innesto sullo scaffold esistente** (non rewrite):

- **Motore MCA** (`lib/valuation/comparables.ts`): `reconcile` ora fa la **griglia di
  omogeneizzazione** (corregge il €/mq di ogni comparabile verso l'immobile via
  rapporto dei coefficienti di merito), media pesata, **clamp** di sanità sul prior
  OMI e **shrinkage** `α=n/(n+k)`. Confidenza raffinata da n/dispersione/freschezza.
- **Sconto offerta→rogito** (`lib/comps/discount.ts`): parametrico per macro-area
  (Nord-Est ~5% default Veneto), applicato ai soli annunci.
- **Data path** (`lib/comps/`, `scripts/ingest-comps.ts`, `/api/comps/webhook`):
  comparabili **comprati via Apify** (Immobiliare.it / Idealista, async+webhook),
  normalizzati (dedup + outlier IQR), cache su `comps` (mig. 0013). Usati come
  **input €/mq aggregato interno — mai mirror ripubblicato** (niente foto/descrizioni).
  Provider PostGIS KNN `SupabaseComparablesProvider`, attivo dietro `COMPS_ENABLED`.
- **Report spiegabile** (`lib/report/valuation-report.ts`): HTML pronto-stampa con
  range + confidenza, breakdown, **griglia di omogeneizzazione attribuita** ("fonte:
  annunci pubblici"), contesto di mercato. Reso nel dettaglio dashboard.

```bash
# dry-run su un export locale del dataset Apify (nessuna scrittura)
npm run ingest:comps -- --portal immobiliare --file data/comps/dataset.json --dry-run
```

> Tetto onesto: una stima online su dati di offerta + OMI plafona a **MdAPE ~6–10%**
> → l'agente revisiona (flywheel). Logica deterministica calcola, l'LLM (Step 2)
> narrerà. Apify/DB live sono gated (token/creds), come i file OMI.

## V3 — Flusso completo (edonica · Perplexity · correzione · 2 report)

Estensione del motore, **innestata sui seam esistenti** (zero rewrite, degrado
pulito senza chiavi). Principio fermo: **i numeri li fa il motore deterministico**;
Perplexity aggiunge contesto, l'LLM corregge solo entro un clamp **tracciato**.

Pipeline: `OMI (ancora) → comparabili Apify 2-raggi → stima EDONICA dei parametri
→ Perplexity (contesto/controllo) → correzione LLM vincolata → valore → 2 report`.

- **Stima edonica** (`lib/valuation/hedonic.ts`): regressione ridge pesata su
  `log(€/mq)` con **prior verso i coefficienti fissi**; stima i premi marginali
  (classe, piano, stato, n. locali, terrazzo, elasticità superficie) dai comp
  reali. `λ = λ0·k/(k+nEff)`: pochi comp ⇒ β≈prior ⇒ **fallback automatico ai
  fissi**. Selezione 2-raggi (largo ~3 km + 30 più vicini) + similarità
  multi-attributo (`comparable-selection.ts`).
- **Zone intelligence** (`lib/perplexity/`): ricerca web (appetibilità zona,
  venduto/vendibile, prezzi medi); lo **scostamento vs OMI lo calcola il codice**,
  non l'LLM. Gated `PERPLEXITY_API_KEY` (assente ⇒ no-op).
- **Correzione vincolata** (`lib/valuation/correction/`): l'LLM propone solo un
  **fattore**; `clamp.ts` lo taglia entro ±`CORRECTION_CLAMP_MAX_PCT` (def 6%) e
  lo applica al valore deterministico (point/min/max stesso fattore). Il valore
  puro resta in `estimate_deterministic_*` (audit); riga di breakdown tracciata.
  Doppio gate `ANTHROPIC_API_KEY` + `CORRECTION_ENABLED`.
- **2 report** (`lib/report/valuation-report.ts`): design editoriale **generico**
  (no logo), `variant: 'agent' | 'client'`. Agente = completo (composizione,
  griglia comparabili, contesto zona, correzione, catasto, perizia); cliente =
  sintetico. Anteprima di entrambi su **`/mock`**. Cliente: email via
  `POST /api/agenti/report-cliente` + anteprima stampabile `/agenti/[ref]/cliente`
  (Salva come PDF).

### Attivazione comparabili (Apify)

```bash
# 1) applicare al DB le migrazioni 0023/0024/0025
# 2) COMPS_ENABLED=true + APIFY_TOKEN in .env.local
# 3) run dell'actor immobiliare.it/idealista su una zona → datasetId, poi:
npm run ingest:comps -- --portal immobiliare --dataset <datasetId>
```

Env opzionali (gated, degradano puliti): `APIFY_TOKEN`, `COMPS_ENABLED`,
`PERPLEXITY_API_KEY`, `CORRECTION_ENABLED`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`.
Vedi `.env.example`. Quando si attiva una logica che cambia i numeri, **bumpare
`VALUATION_MODEL_VERSION`** (non ricalcola lo storico, applica il nuovo ai nuovi).

## Roadmap (Fase 1) — ✅ completa

- [x] **M1** — scaffold Next.js + migrazioni Supabase/PostGIS + seed coefficienti
- [x] **M2** — motore di valutazione (TS puro) + test Vitest con fixture OMI
- [x] **M3** — ingestion OMI (`scripts/ingest-omi.ts`) + risoluzione zona PostGIS
- [x] **M4** — API route `/api/valutazione` (validate→commit→enrich→email→200)
- [x] **M5** — funnel funzionante `/valutazione` (geocoding dietro interfaccia)
- [x] **M6** — dashboard agente `/agenti` (auth + RLS + chiusura flywheel)

### V2 / V3 — ✅ completa (codice; attivazione dati/chiavi gated)

- [x] **OMI reale** ingerito (2025-2 nazionale) + ingestione resiliente
- [x] **Comparabili MCA** + sconto offerta→rogito + filtro gruppo di mercato
- [x] **Narrazione + perizia** LLM grounded · **document intelligence** (catasto/APE/planimetrie)
- [x] **Stima edonica** dei parametri dai comparabili (Fase 2)
- [x] **Comparabili 2-raggi** + attributi (locali/terrazzo) (Fase 1)
- [x] **Zone intelligence** Perplexity (Fase 3) + **correzione LLM vincolata** (Fase 4)
- [x] **2 report** generici (agente/cliente) + consegna email/anteprima PDF (Fase 5)
- [ ] *Attivazione*: actor Apify + migrazioni 0023-0025 + chiavi Perplexity/correzione
- [ ] *Polish*: PDF auto-allegato (`@react-pdf`) · restyle generico funnel/landing
