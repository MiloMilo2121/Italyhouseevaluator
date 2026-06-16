-- 0008_seed_default_coefficient_set.sql
-- Set di coefficienti di default (attivo). Il motore legge questi valori; i test
-- asseriscono contro questi numeri esatti → fanno parte del contratto.
-- Per ricalibrare: inserire un NUOVO set (version 2) e spostare `active` (mai
-- modificare questo in-place — vedi invariante in 0003).
--
-- merit_coefficients.piano è una DECISION TABLE completa (posizione × ascensore
-- × ultimo). Regola di precedenza applicata in TS: la penalità "alto senza
-- ascensore" (0.80) DOMINA "ultimo senza ascensore" (0.85): un attico-walk-up al
-- 5° → 0.80, non 0.85. Con ascensore l'ultimo (1.05) domina l'intermedio (1.00).

insert into coefficient_sets (name, version, active, superficie_weights, merit_coefficients)
values (
  'default',
  1,
  true,
  '{
    "superficie_utile": 1.00,
    "balcone_scoperto": 0.25,
    "balcone_coperto": 0.35,
    "terrazzo_scoperto": 0.25,
    "giardino_appartamento": 0.15,
    "cantina_non_comunicante": 0.25,
    "soffitta_non_comunicante": 0.25,
    "default_area_balcone_mq": 6,
    "default_area_giardino_mq": 25,
    "box_auto_mq_default": 15,
    "box_auto_coeff": 0.45
  }'::jsonb,
  '{
    "piano": {
      "interrato": 0.80,
      "seminterrato": 0.85,
      "terra_rialzato": 0.95,
      "basso_con_asc": 1.00,
      "basso_senza_asc": 0.95,
      "alto_con_asc": 1.00,
      "alto_senza_asc": 0.80,
      "ultimo_con_asc": 1.05,
      "ultimo_senza_asc": 0.85,
      "default": 1.00
    },
    "classe_energetica": {
      "A4": 1.10, "A3": 1.085, "A2": 1.07, "A1": 1.055, "A": 1.05,
      "B": 1.03, "C": 1.015, "D": 1.00, "E": 0.985, "F": 0.97, "G": 0.955,
      "default": 1.00
    },
    "luminosita_esposizione": { "default": 1.00 },
    "stato_corrective": { "Ottimo": 1.10, "Normale": 1.00, "Scadente": 0.85 },
    "range": {
      "confidence_multiplier": { "Alta": 1.00, "Media": 1.25, "Bassa": 1.60 },
      "min_rel_halfwidth": { "Alta": 0.04, "Media": 0.08, "Bassa": 0.14 }
    }
  }'::jsonb
);
