import { describe, it, expect } from 'vitest';
import {
  isValidSemestre,
  parseComprValue,
  parseFascia,
  parseItalianNumber,
  parseLocValue,
  parseOmiStato,
} from '@/lib/omi/normalize';

describe('normalizzazione valori OMI (§7)', () => {
  it('decimali italiani (virgola) → number, separatore migliaia gestito', () => {
    expect(parseItalianNumber('2.800,00')).toBe(2800);
    expect(parseItalianNumber('1.234.567,89')).toBe(1234567.89);
    expect(parseItalianNumber('10,50')).toBe(10.5);
    expect(parseItalianNumber('')).toBeNull();
    expect(parseItalianNumber('n/d')).toBeNull();
  });

  it('locazione 0 (≈10% del dato grezzo) → null', () => {
    expect(parseLocValue('0,00')).toBeNull();
    expect(parseLocValue('10,50')).toBe(10.5);
  });

  it('compravendita: 0/non valido → null', () => {
    expect(parseComprValue('0,00')).toBeNull();
    expect(parseComprValue('3.500,00')).toBe(3500);
  });

  it('stato OMI normalizzato nell’enum; ignoto → null', () => {
    expect(parseOmiStato('NORMALE')).toBe('Normale');
    expect(parseOmiStato('ottimo')).toBe('Ottimo');
    expect(parseOmiStato('SCADENTE')).toBe('Scadente');
    expect(parseOmiStato('???')).toBeNull();
  });

  it('fascia B/C/D/E/R; ignota → null; semestre YYYY-S', () => {
    expect(parseFascia('b')).toBe('B');
    expect(parseFascia('Z')).toBeNull();
    expect(isValidSemestre('2024-2')).toBe(true);
    expect(isValidSemestre('2024-3')).toBe(false);
  });
});
