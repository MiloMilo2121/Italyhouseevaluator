import { describe, it, expect } from 'vitest';
import { applyReconciliation, buildDocumentFacts, toDeclaredFacts } from '@/lib/documents/reconcile';
import type { ReconciliationResult } from '@/lib/documents/types';
import { makeSubject } from './fixtures/subjects.fixture';
import { makeReconciliation } from './fixtures/documents.fixture';

describe('applyReconciliation (guardrail puro)', () => {
  it('applica un override whitelist ad alta confidenza (APE D→C)', () => {
    const out = applyReconciliation(makeSubject({ classeEnergetica: 'D' }), makeReconciliation());
    expect(out.correctedSubject.classeEnergetica).toBe('C');
    expect(out.appliedOverrides).toHaveLength(1);
    expect(out.appliedOverrides[0]?.field).toBe('classeEnergetica');
    expect(out.rejected).toHaveLength(0);
  });

  it('scarta confidenza bassa → dubbio, subject invariato', () => {
    const r = makeReconciliation({
      overrides: [
        { field: 'classeEnergetica', value: 'A', confidence: 'bassa', sourceDocument: 'ape', justification: 'incerto' },
      ],
    });
    const out = applyReconciliation(makeSubject({ classeEnergetica: 'D' }), r);
    expect(out.correctedSubject.classeEnergetica).toBe('D');
    expect(out.appliedOverrides).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
  });

  it('scarta un field fuori whitelist (difesa in profondità)', () => {
    const r = {
      overrides: [
        { field: 'location', value: 'x', confidence: 'alta', sourceDocument: 'x', justification: 'x' },
      ],
      dubbi: [],
      sintesi: '',
    } as unknown as ReconciliationResult;
    const out = applyReconciliation(makeSubject(), r);
    expect(out.appliedOverrides).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
  });

  it('scarta un valore fuori enum (classe inesistente)', () => {
    const r = makeReconciliation({
      overrides: [
        { field: 'classeEnergetica', value: 'Z9', confidence: 'alta', sourceDocument: 'ape', justification: 'x' },
      ],
    });
    const out = applyReconciliation(makeSubject(), r);
    expect(out.appliedOverrides).toHaveLength(0);
    expect(out.rejected[0]?.campo).toBe('classeEnergetica');
  });

  it('scarta una superficie fuori banda (±50%)', () => {
    const r = makeReconciliation({
      overrides: [
        { field: 'superficieMq', value: '200', confidence: 'alta', sourceDocument: 'planimetria', justification: 'x' },
      ],
    });
    const out = applyReconciliation(makeSubject({ superficieMq: 85 }), r);
    expect(out.correctedSubject.superficieMq).toBe(85);
    expect(out.rejected).toHaveLength(1);
  });

  it('applica una superficie entro banda e coercizza stringa→numero', () => {
    const r = makeReconciliation({
      overrides: [
        { field: 'superficieMq', value: '95', confidence: 'media', sourceDocument: 'planimetria', justification: 'quotata' },
      ],
    });
    const out = applyReconciliation(makeSubject({ superficieMq: 90 }), r);
    expect(out.correctedSubject.superficieMq).toBe(95);
    expect(out.appliedOverrides[0]?.value).toBe(95);
  });

  it('coercizza ascensore booleano da "no"', () => {
    const r = makeReconciliation({
      overrides: [
        { field: 'ascensore', value: 'no', confidence: 'alta', sourceDocument: 'nota_vocale', justification: 'x' },
      ],
    });
    const out = applyReconciliation(makeSubject({ ascensore: true }), r);
    expect(out.correctedSubject.ascensore).toBe(false);
  });

  it('reconciliation vuota → subject invariato', () => {
    const subject = makeSubject();
    const out = applyReconciliation(subject, { overrides: [], dubbi: [], sintesi: '' });
    expect(out.correctedSubject).toEqual(subject);
    expect(out.appliedOverrides).toHaveLength(0);
    expect(out.rejected).toHaveLength(0);
  });

  it('preserva la provenienza negli override applicati', () => {
    const out = applyReconciliation(makeSubject({ classeEnergetica: 'D' }), makeReconciliation());
    expect(out.appliedOverrides[0]?.sourceDocument).toBe('ape');
    expect(out.appliedOverrides[0]?.justification).toContain('APE');
  });
});

describe('buildDocumentFacts', () => {
  it('unisce i dubbi del reconciler e i rejected, e fissa generatedAt', () => {
    const r = makeReconciliation({
      dubbi: [{ campo: 'condizioni', dichiarato: 'nuova', rilevato: 'ristrutturata', nota: 'contraddizione' }],
    });
    const out = applyReconciliation(makeSubject({ classeEnergetica: 'D' }), r);
    const facts = buildDocumentFacts(r, out.appliedOverrides, out.rejected, '2026-01-01T00:00:00.000Z');
    expect(facts.appliedOverrides).toHaveLength(1);
    expect(facts.dubbi).toHaveLength(1);
    expect(facts.generatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('toDeclaredFacts', () => {
  it('estrae il sottoinsieme dichiarato senza location/PII', () => {
    const f = toDeclaredFacts(makeSubject({ superficieMq: 85 }));
    expect(f.superficieMq).toBe(85);
    expect(Object.keys(f)).not.toContain('location');
  });
});
