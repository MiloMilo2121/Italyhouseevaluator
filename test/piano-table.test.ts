import { describe, it, expect } from 'vitest';
import { resolvePianoFactor } from '@/lib/valuation/coefficient';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';

const T = defaultCoefficientSet.meritCoefficients.piano;

describe('decision table piano (fix #1: completa e deterministica)', () => {
  it('interrato / seminterrato (indipendenti dall’ascensore)', () => {
    expect(resolvePianoFactor(null, 'interrato', null, true, T).factor).toBe(0.8);
    expect(resolvePianoFactor(null, 'interrato', null, false, T).factor).toBe(0.8);
    expect(resolvePianoFactor(null, 'seminterrato', null, false, T).factor).toBe(0.85);
  });

  it('terra / rialzato (anche piano 0)', () => {
    expect(resolvePianoFactor(null, 'terra', null, false, T).factor).toBe(0.95);
    expect(resolvePianoFactor(null, 'rialzato', null, true, T).factor).toBe(0.95);
    expect(resolvePianoFactor(0, null, 5, true, T).factor).toBe(0.95);
  });

  it('piani bassi 1°–2°', () => {
    expect(resolvePianoFactor(2, null, 5, true, T).factor).toBe(1.0); // con ascensore
    expect(resolvePianoFactor(2, null, 5, false, T).factor).toBe(0.95); // senza ascensore
  });

  it('piani alti 3°+ intermedi', () => {
    expect(resolvePianoFactor(3, null, 6, true, T).factor).toBe(1.0);
    // 6° con ascensore non-ultimo → 1.00 (perde il premio attico)
    expect(resolvePianoFactor(6, null, 8, true, T).factor).toBe(1.0);
    // 4° senza ascensore → penalità alto
    expect(resolvePianoFactor(4, null, 8, false, T).factor).toBe(0.8);
  });

  it('ultimo piano', () => {
    expect(resolvePianoFactor(6, null, 6, true, T).factor).toBe(1.05); // ultimo con ascensore
    expect(resolvePianoFactor(2, null, 2, false, T).factor).toBe(0.85); // ultimo basso senza ascensore
  });

  it('PRECEDENZA: alto-senza-ascensore domina ultimo (attico-walk-up al 5° → 0.80, non 0.85)', () => {
    const r = resolvePianoFactor(5, null, 5, false, T);
    expect(r.factor).toBe(0.8);
    expect(r.key).toBe('alto_senza_asc');
  });

  it('piano sconosciuto → fattore neutro 1.00', () => {
    expect(resolvePianoFactor(null, null, null, true, T).factor).toBe(1.0);
  });
});
