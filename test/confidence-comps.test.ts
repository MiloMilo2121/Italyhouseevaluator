import { describe, it, expect } from 'vitest';
import { computeConfidence } from '@/lib/valuation/confidence';
import { makeSubject } from './fixtures/subjects.fixture';
import type { OmiQuotationRow } from '@/lib/valuation/types';

const row: OmiQuotationRow = {
  linkZona: 'A',
  comuneCode: 'F205',
  fascia: 'B',
  tipologia: 'Abitazioni civili',
  stato: 'Normale',
  comprMin: 2000,
  comprMax: 2400, // spread 0.2 ⇒ nessuna penalità
  semestre: '2024-2',
};
const subj = makeSubject(); // classe A, piano 3, stanze 3 ⇒ nessuna penalità attributi

describe('confidenza raffinata dai comparabili (V2)', () => {
  it('comparabili buoni (molti, freschi, concordi) alzano lo score', () => {
    const noComps = computeConfidence({ fallbackLevel: 'nearest', omiRow: row, subject: subj });
    expect(noComps.score).toBe(70); // 100 − 30 (nearest)

    const good = computeConfidence({
      fallbackLevel: 'nearest',
      omiRow: row,
      subject: subj,
      comps: { n: 5, relDispersion: 0.05, avgMonths: 6 },
    });
    expect(good.score).toBe(85); // 70 + min(5,6)·3
    expect(good.label).toBe('Alta');
  });

  it('comparabili pochi, dispersi e vecchi abbassano lo score', () => {
    const poor = computeConfidence({
      fallbackLevel: 'nearest',
      omiRow: row,
      subject: subj,
      comps: { n: 1, relDispersion: 0.3, avgMonths: 24 },
    });
    expect(poor.score).toBe(48); // 70 + 3 − 15 − 10
    expect(poor.label).toBe('Media');
  });

  it('senza comparabili la confidenza è quella base (immutata)', () => {
    const base = computeConfidence({ fallbackLevel: 'none', omiRow: row, subject: subj });
    expect(base.score).toBe(100);
  });
});
