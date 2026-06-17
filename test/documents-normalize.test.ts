import { describe, it, expect } from 'vitest';
import { normalizeCatasto } from '@/lib/documents/normalize';
import { CATASTO_RAW_FIXTURE } from './fixtures/documents.fixture';

describe('normalizeCatasto', () => {
  it('mappa il payload grezzo a CatastoData tipato, con numeri in formato IT', () => {
    const c = normalizeCatasto(CATASTO_RAW_FIXTURE);
    expect(c.categoria).toBe('A/2');
    expect(c.classe).toBe('3');
    expect(c.renditaEuro).toBeCloseTo(750.5, 2);
    expect(c.consistenzaVani).toBe(5.5);
    expect(c.superficieCatastaleMq).toBe(95);
    expect(c.foglio).toBe('12');
    expect(c.particella).toBe('340');
    expect(c.subalterno).toBe('7');
  });

  it('degrada a null sui campi mancanti senza lanciare', () => {
    const c = normalizeCatasto({});
    expect(c.categoria).toBeNull();
    expect(c.renditaEuro).toBeNull();
    expect(c.foglio).toBeNull();
  });

  it('tollera input non-oggetto', () => {
    expect(() => normalizeCatasto(null)).not.toThrow();
    expect(normalizeCatasto('x').categoria).toBeNull();
  });
});
