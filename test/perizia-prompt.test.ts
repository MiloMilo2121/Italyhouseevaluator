import { describe, it, expect } from 'vitest';
import {
  buildPeriziaInput,
  buildPeriziaUserContent,
  PERIZIA_JSON_SCHEMA,
  PERIZIA_SYSTEM,
  PeriziaSchema,
} from '@/lib/perizia/prompt';
import type { EnrichResult } from '@/lib/valuation/types';
import { makeCatasto } from './fixtures/documents.fixture';

function makeEnrich(over: Partial<EnrichResult> = {}): EnrichResult {
  return {
    superficie_commerciale_mq: 90,
    zona_omi_id: 'A',
    fallback_level: 'none',
    omi_eur_mq_min: 3500,
    omi_eur_mq_max: 4200,
    coefficients_applied: { merito_totale: 1.015 },
    estimate_min: 300000,
    estimate_max: 360000,
    confidence: { score: 80, label: 'Alta', fsd: 0.05 },
    breakdown: [{ label: 'Prezzo base zona', contributo: 330000 }],
    comparables: [],
    ...over,
  };
}

const ctx = {
  referenceId: 'VAL-TEST0001',
  indirizzo: 'Via Test 1',
  comune: 'Milano',
  propertyType: 'appartamento',
  superficieDichiarataMq: 85,
};

describe('perizia prompt', () => {
  it('il system prompt vieta di calcolare/inventare', () => {
    expect(PERIZIA_SYSTEM).toMatch(/NON calcolare/);
    expect(PERIZIA_SYSTEM).toMatch(/NON inventare/);
  });

  it('buildPeriziaInput porta i numeri del motore e gli extra', () => {
    const input = buildPeriziaInput(makeEnrich(), ctx, {
      catasto: makeCatasto(),
      documentFacts: null,
      narrative: null,
      transcripts: ['Bagno rifatto.'],
    });
    expect(input.estimate_min).toBe(300000);
    expect(input.superficie_commerciale_mq).toBe(90);
    expect(input.superficie_dichiarata_mq).toBe(85);
    expect(input.catasto?.categoria).toBe('A/2');
    expect(input.voice_transcripts).toContain('Bagno rifatto.');
    expect(input.comparables.count).toBe(0);
  });

  it('lo schema/zod coprono tutte e 10 le sezioni', () => {
    const schema = PERIZIA_JSON_SCHEMA as unknown as { required: string[] };
    expect(schema.required).toHaveLength(10);
    const valid = {
      premessa: 'a',
      identificazione_immobile: 'b',
      descrizione: 'c',
      dati_catastali: 'd',
      analisi_mercato: 'e',
      analisi_comparabili: 'f',
      considerazioni_documentali: 'g',
      metodo_valutativo: 'h',
      conclusione_valore: 'i',
      limiti_assunzioni: 'l',
    };
    expect(PeriziaSchema.safeParse(valid).success).toBe(true);
    expect(PeriziaSchema.safeParse({ premessa: 'a' }).success).toBe(false);
  });

  it('buildPeriziaUserContent serializza il dossier', () => {
    const txt = buildPeriziaUserContent(
      buildPeriziaInput(makeEnrich(), ctx, { catasto: null, documentFacts: null, narrative: null, transcripts: [] }),
    );
    expect(txt).toContain('"estimate_min": 300000');
  });
});
