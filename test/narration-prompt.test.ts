import { describe, it, expect } from 'vitest';
import {
  NARRATION_SYSTEM,
  NarrativeSchema,
  buildNarrationInput,
  buildNarrationUserContent,
} from '@/lib/narration/prompt';
import { NullNarrator } from '@/lib/narration/factory';
import type { ComparableContribution, EnrichResult } from '@/lib/valuation/types';

function enrichWith(comparables: ComparableContribution[]): EnrichResult {
  return {
    superficie_commerciale_mq: 85,
    zona_omi_id: 'MI_1',
    fallback_level: 'none',
    omi_eur_mq_min: 3500,
    omi_eur_mq_max: 4200,
    coefficients_applied: { merito_totale: 1.05 },
    estimate_min: 312375,
    estimate_max: 374850,
    confidence: { score: 88, label: 'Alta', fsd: 0.05 },
    breakdown: [{ label: 'Prezzo base zona', contributo: 327250 }],
    comparables,
  };
}

const comp = (id: string, correctedEurMq: number): ComparableContribution => ({
  id,
  source: 'annuncio',
  distanceMeters: 250,
  saleDate: '2025-11-01',
  stato: 'Normale',
  rawEurMq: 3000,
  discountedEurMq: 2850,
  correctedEurMq,
  weight: 0.8,
});

describe('buildNarrationInput — grounding di soli numeri calcolati', () => {
  it('riporta i numeri del motore e una sintesi comps aggregata (niente PII)', () => {
    const e = enrichWith([comp('a', 2900), comp('b', 3100), comp('c', 3000)]);
    const input = buildNarrationInput(e, { referenceId: 'VAL-ABC', indirizzo: 'Via Roma 1, Milano', comune: 'Milano' });

    expect(input.reference_id).toBe('VAL-ABC');
    expect(input.estimate_min).toBe(312375);
    expect(input.estimate_max).toBe(374850);
    expect(input.confidence_label).toBe('Alta');
    expect(input.zona_omi_id).toBe('MI_1');
    expect(input.breakdown).toEqual([{ label: 'Prezzo base zona', contributo: 327250 }]);
    // comps aggregati: count + range del €/mq omogeneizzato, mai i singoli annunci
    expect(input.comparables.count).toBe(3);
    expect(input.comparables.eur_mq_min).toBe(2900);
    expect(input.comparables.eur_mq_max).toBe(3100);
    // nessun campo di PII del lead nel payload
    expect(JSON.stringify(input)).not.toMatch(/nome|cognome|telefon|email/i);
  });

  it('senza comparabili la sintesi è a zero (min/max null)', () => {
    const input = buildNarrationInput(enrichWith([]), { referenceId: 'VAL-X', indirizzo: null, comune: null });
    expect(input.comparables.count).toBe(0);
    expect(input.comparables.eur_mq_min).toBeNull();
    expect(input.comparables.eur_mq_max).toBeNull();
  });

  it('il prompt utente serializza il payload di grounding', () => {
    const input = buildNarrationInput(enrichWith([]), { referenceId: 'VAL-X', indirizzo: null, comune: null });
    const content = buildNarrationUserContent(input);
    expect(content).toContain('VAL-X');
    expect(content).toContain('"estimate_min": 312375');
  });
});

describe('NARRATION_SYSTEM — regole di grounding', () => {
  it('vieta esplicitamente di calcolare o inventare numeri', () => {
    expect(NARRATION_SYSTEM).toMatch(/non calcolare/i);
    expect(NARRATION_SYSTEM).toMatch(/non inventare/i);
    expect(NARRATION_SYSTEM).toMatch(/non disponibile/i);
  });
});

describe('NarrativeSchema', () => {
  it('accetta una narrazione valida con tutti i campi di prosa', () => {
    const ok = NarrativeSchema.safeParse({
      sintesi: 's',
      spiegazione_valore: 's',
      commento_comparabili: 's',
      contesto_mercato: 's',
      nota_confidenza: 's',
    });
    expect(ok.success).toBe(true);
  });

  it('rifiuta una narrazione con un campo mancante', () => {
    const bad = NarrativeSchema.safeParse({ sintesi: 's' });
    expect(bad.success).toBe(false);
  });
});

describe('NullNarrator (degrado senza LLM)', () => {
  it('ritorna null ⇒ il report mostra solo i numeri', async () => {
    const input = buildNarrationInput(enrichWith([]), { referenceId: 'VAL-X', indirizzo: null, comune: null });
    expect(await new NullNarrator().narrate(input)).toBeNull();
  });
});
