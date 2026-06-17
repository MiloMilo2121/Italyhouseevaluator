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

Le migrazioni sono file SQL versionati in `supabase/migrations/0001..0008`
(append-only: non modificare una migrazione già spedita, aggiungerne una nuova).
La baseline consolidata in singolo file è `valutatore_schema.sql`.

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

```bash
# dry-run: pipeline + report, senza scrivere su DB
npm run ingest:omi -- --dry-run --semestre 2024-2 \
  --valori data/omi/valori.csv --zone data/omi/zone.csv --kml data/omi/zone.kml

# ingestion reale (upsert idempotente su Supabase)
npm run ingest:omi -- --semestre 2024-2 \
  --valori data/omi/valori.csv --zone data/omi/zone.csv --kml data/omi/zone.kml
```

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
  email/                   # template Resend (M4)
  geocoding/               # GeocodingProvider + impl (M5)
  db/                      # client Supabase
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

## Roadmap (Fase 1)

- [x] **M1** — scaffold Next.js + migrazioni Supabase/PostGIS + seed coefficienti
- [x] **M2** — motore di valutazione (TS puro) + test Vitest con fixture OMI
- [x] **M3** — ingestion OMI (`scripts/ingest-omi.ts`) + risoluzione zona PostGIS
- [ ] **M4** — API route `/api/valutazione` + email Resend
- [ ] **M5** — funnel funzionante (geocoding dietro interfaccia)
- [ ] **M6** — dashboard agente (chiusura flywheel)
