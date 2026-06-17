import { describe, it, expect } from 'vitest';
import {
  EXPECTED_VALORI_HEADERS,
  OmiHeaderMismatchError,
  parseOmiCsv,
  validateHeaders,
} from '@/lib/omi/csv';
import { SAMPLE_VALORI } from './fixtures/omi-sample.fixture';

describe('parsing CSV OMI (§7, §8)', () => {
  it('scarta la didascalia, valida l’header e mappa le righe (gestendo il ; finale)', () => {
    const { rows, malformedLineNumbers } = parseOmiCsv(SAMPLE_VALORI, EXPECTED_VALORI_HEADERS);
    expect(rows).toHaveLength(3);
    expect(malformedLineNumbers).toEqual([]);
    expect(rows[0]!['LinkZona']).toBe('MI_1');
    expect(rows[0]!['Stato']).toBe('NORMALE');
    expect(rows[0]!['Compr_min']).toBe('2.800,00');
    expect(rows[1]!['Stato']).toBe('OTTIMO');
  });

  it('§8: intestazioni non conformi ⇒ errore chiaro (fail-fast), niente mappatura silenziosa', () => {
    const wrong = ['didascalia;', 'A;B;C;', '1;2;3;'].join('\n');
    expect(() => parseOmiCsv(wrong, EXPECTED_VALORI_HEADERS)).toThrow(OmiHeaderMismatchError);
  });

  it('righe con meno colonne dell’atteso sono segnalate, non mappate male', () => {
    const csv = [
      'didascalia;',
      EXPECTED_VALORI_HEADERS.join(';') + ';',
      'troppo;corta;', // riga malformata
    ].join('\n');
    const { rows, malformedLineNumbers } = parseOmiCsv(csv, EXPECTED_VALORI_HEADERS);
    expect(rows).toHaveLength(0);
    expect(malformedLineNumbers).toHaveLength(1);
  });

  it('validateHeaders accetta l’header esatto', () => {
    expect(() => validateHeaders([...EXPECTED_VALORI_HEADERS], EXPECTED_VALORI_HEADERS)).not.toThrow();
  });
});
