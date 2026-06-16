import { describe, it, expect } from 'vitest';
import { computeConfidence, scoreToLabel } from '@/lib/valuation/confidence';
import { makeSubject } from './fixtures/subjects.fixture';
import type { OmiQuotationRow } from '@/lib/valuation/types';

const row = (comprMin: number, comprMax: number): OmiQuotationRow => ({
  linkZona: 'X',
  comuneCode: 'F205',
  fascia: 'B',
  tipologia: 'Abitazioni civili',
  stato: 'Normale',
  comprMin,
  comprMax,
  semestre: '2024-2',
});

describe('confidence score (§6.7)', () => {
  it('spread OMI molto ampio (>0.5) penalizza più di uno moderato', () => {
    const moderato = computeConfidence({ fallbackLevel: 'none', omiRow: row(1000, 1350), subject: makeSubject() });
    const ampio = computeConfidence({ fallbackLevel: 'none', omiRow: row(1000, 1700), subject: makeSubject() });
    expect(moderato.score).toBe(90); // 100 − 10 (spread 0.35)
    expect(ampio.score).toBe(80); // 100 − 20 (spread 0.70)
  });

  it('dati OMI assenti fuori da prior_only penalizzano per riga mancante', () => {
    const c = computeConfidence({ fallbackLevel: 'comune', omiRow: null, subject: makeSubject() });
    expect(c.score).toBe(15); // 100 − 45 (comune) − 40 (no row)
    expect(c.label).toBe('Bassa');
  });

  it('attributi chiave mancanti abbassano lo score (classe −8, piano −5, stanze −3)', () => {
    const full = computeConfidence({ fallbackLevel: 'none', omiRow: row(2000, 2400), subject: makeSubject() });
    const poor = computeConfidence({
      fallbackLevel: 'none',
      omiRow: row(2000, 2400),
      subject: makeSubject({ classeEnergetica: null, piano: null, pianoLabel: null, stanze: null }),
    });
    expect(poor.score).toBe(full.score - 8 - 5 - 3);
  });

  it('scoreToLabel: soglie Alta ≥75, Media ≥45, Bassa <45', () => {
    expect(scoreToLabel(75)).toBe('Alta');
    expect(scoreToLabel(74)).toBe('Media');
    expect(scoreToLabel(45)).toBe('Media');
    expect(scoreToLabel(44)).toBe('Bassa');
  });
});
