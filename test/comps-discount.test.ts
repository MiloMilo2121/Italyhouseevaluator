import { describe, it, expect } from 'vitest';
import {
  NATIONAL_DISCOUNT,
  discountRate,
  discountedEurMq,
} from '@/lib/comps/discount';

describe('sconto offerta→rogito (V2)', () => {
  it('tasso per macro-area; default nazionale senza area', () => {
    expect(discountRate('nord_est')).toBe(0.05);
    expect(discountRate('sud_isole')).toBe(0.1);
    expect(discountRate()).toBe(NATIONAL_DISCOUNT);
  });

  it('sconto applicato SOLO agli annunci (offerta); rogiti/agency invariati', () => {
    expect(discountedEurMq(2000, 'annuncio', 'nord_est')).toBe(1900); // 2000 × 0.95
    expect(discountedEurMq(2000, 'annuncio')).toBe(1846); // 2000 × (1 − 0.077)
    expect(discountedEurMq(2000, 'rogito', 'nord_est')).toBe(2000);
    expect(discountedEurMq(2000, 'agency')).toBe(2000);
    expect(discountedEurMq(2000, undefined)).toBe(2000);
  });
});
