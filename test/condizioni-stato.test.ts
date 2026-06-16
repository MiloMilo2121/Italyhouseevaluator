import { describe, it, expect } from 'vitest';
import { condizioniToStato } from '@/lib/valuation/omi';

describe('condizioni → stato OMI (fix #2: anni_ristrutturazione non più ignorato)', () => {
  it('nuova → Ottimo', () => {
    expect(condizioniToStato('nuova', null)).toBe('Ottimo');
  });

  it('ristrutturata recente (<5, 5-10) → Ottimo', () => {
    expect(condizioniToStato('ristrutturata', '<5')).toBe('Ottimo');
    expect(condizioniToStato('ristrutturata', '5-10')).toBe('Ottimo');
  });

  it('ristrutturata >10 anni → Normale (decadimento, niente sovrastima)', () => {
    expect(condizioniToStato('ristrutturata', '>10')).toBe('Normale');
  });

  it('parz_ristrutturata → Normale; da_ristrutturare → Scadente', () => {
    expect(condizioniToStato('parz_ristrutturata', null)).toBe('Normale');
    expect(condizioniToStato('da_ristrutturare', '>10')).toBe('Scadente');
  });
});
