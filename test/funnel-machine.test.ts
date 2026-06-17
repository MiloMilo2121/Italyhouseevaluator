import { describe, it, expect } from 'vitest';
import {
  firstStep,
  isComplete,
  isStepComplete,
  nextStep,
  prevStep,
  progress,
  validateStep,
  visibleSteps,
} from '@/lib/funnel/machine';
import { makeFunnelData } from './fixtures/funnel.fixture';
import type { FunnelData } from '@/lib/funnel/types';

const full = makeFunnelData();

describe('funnel state machine (§12)', () => {
  it('ordine e navigazione', () => {
    expect(firstStep(full)).toBe('indirizzo');
    expect(visibleSteps(full)).toHaveLength(11);
    expect(nextStep('condizioni', full)).toBe('piano');
    expect(prevStep('piano', full)).toBe('condizioni');
    expect(nextStep('contatti', full)).toBeNull();
    expect(prevStep('indirizzo', full)).toBeNull();
  });

  it('branching: anni_ristrutturazione richiesto solo se ristrutturata', () => {
    expect(validateStep('condizioni', { condizioni: 'ristrutturata' }).ok).toBe(false);
    expect(validateStep('condizioni', { condizioni: 'ristrutturata', anni_ristrutturazione: '<5' }).ok).toBe(true);
    expect(validateStep('condizioni', { condizioni: 'nuova' }).ok).toBe(true);
  });

  it('SALTA: gli step opzionali sono sempre "completi"; i richiesti no se vuoti', () => {
    expect(isStepComplete('riscaldamento', {})).toBe(true);
    expect(isStepComplete('classe_energetica', {})).toBe(true);
    expect(isStepComplete('superficie', {})).toBe(false);
  });

  it('isComplete solo quando tutti i richiesti sono validi', () => {
    expect(isComplete(full)).toBe(true);
    const noSurface = makeFunnelData();
    delete (noSurface as Partial<FunnelData>).superficie_mq;
    expect(isComplete(noSurface)).toBe(false);
    expect(isComplete(makeFunnelData({ consent_privacy: false }))).toBe(false);
  });

  it('progress conta gli step visibili', () => {
    const p = progress('contatti', full);
    expect(p).toEqual({ index: 10, total: 11, ratio: 1 });
  });
});
