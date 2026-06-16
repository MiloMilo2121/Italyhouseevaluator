-- 0002_enums.sql
-- Enum nativi per i domini stabili (integrità a livello DB + propagazione nei
-- tipi TS generati). I campi soggetti a evoluzione (piano_label,
-- anni_ristrutturazione, confidence_label) restano text + CHECK sulle tabelle.

create type intent_enum as enum (
  'vendere_ora', 'vendere_dopo', 'comprare_ora', 'comprare_dopo'
);

create type property_type_enum as enum (
  'appartamento', 'attico', 'mansarda', 'casa_indipendente',
  'loft', 'rustico_casale', 'villa', 'villetta_schiera'
);

create type condizioni_enum as enum (
  'nuova', 'ristrutturata', 'parz_ristrutturata', 'da_ristrutturare'
);

create type riscaldamento_enum as enum (
  'autonomo', 'centralizzato', 'assente'
);

-- Fasce OMI: B/C/D/E/R = Centrale/Semicentrale/Periferica/Suburbana/Rurale.
create type fascia_enum as enum ('B', 'C', 'D', 'E', 'R');

create type omi_stato_enum as enum ('Ottimo', 'Normale', 'Scadente');

create type fallback_level_enum as enum ('none', 'nearest', 'comune', 'prior_only');

create type valuation_status_enum as enum ('pending', 'enriched', 'completed');

create type lead_status_enum as enum ('new', 'contacted', 'qualified', 'closed');
