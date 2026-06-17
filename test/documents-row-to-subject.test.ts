import { describe, it, expect } from 'vitest';
import { rowToSubjectProperty } from '@/lib/documents/row-to-subject';
import { makeValuationRow } from './fixtures/documents.fixture';

describe('rowToSubjectProperty', () => {
  it('coercizza le colonne string→number e mappa i campi chiave', () => {
    const s = rowToSubjectProperty(makeValuationRow());
    expect(s.superficieMq).toBe(85);
    expect(s.piano).toBe(3);
    expect(s.pianiEdificio).toBe(6);
    expect(s.ascensore).toBe(true);
    expect(s.condizioni).toBe('ristrutturata');
    expect(s.anniRistrutturazione).toBe('<5');
    expect(s.classeEnergetica).toBe('D');
    expect(s.location).toEqual({ lat: 44.1, lng: 12.2 });
  });

  it('gestisce null/assenti senza lanciare', () => {
    const s = rowToSubjectProperty(
      makeValuationRow({
        stanze: null,
        piano: null,
        lat: null,
        lng: null,
        anni_ristrutturazione: null,
        riscaldamento: null,
        classe_energetica: null,
      }),
    );
    expect(s.stanze).toBeNull();
    expect(s.piano).toBeNull();
    expect(s.location).toEqual({ lat: 0, lng: 0 });
    expect(s.classeEnergetica).toBeNull();
  });
});
