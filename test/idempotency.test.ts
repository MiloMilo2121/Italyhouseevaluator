import { describe, it, expect } from 'vitest';
import { computeInputHash, referenceIdFromHash, type HashContext } from '@/lib/valuation/hash';
import { makeSubject } from './fixtures/subjects.fixture';
import type { SubjectProperty } from '@/lib/valuation/types';

const ctx: HashContext = {
  leadEmail: 'mario.rossi@example.it',
  coefficientSetId: 'cs-1',
  coefficientSetVersion: 1,
  modelVersion: 1,
};

describe('idempotenza (§9)', () => {
  it('stesso input + stessa email + stesse versioni ⇒ stesso hash e reference_id', () => {
    const a = computeInputHash(makeSubject(), ctx);
    const b = computeInputHash(makeSubject(), ctx);
    expect(a).toBe(b);
    expect(referenceIdFromHash(a)).toBe(referenceIdFromHash(b));
  });

  it('il reference_id ha formato VAL-XXXXXXXX deterministico', () => {
    expect(referenceIdFromHash(computeInputHash(makeSubject(), ctx))).toMatch(/^VAL-[0-9A-F]{8}$/);
  });

  it('email diversa ⇒ hash diverso (no collisioni tra lead distinti)', () => {
    expect(computeInputHash(makeSubject(), { ...ctx, leadEmail: 'altro@example.it' })).not.toBe(
      computeInputHash(makeSubject(), ctx),
    );
  });

  it('email case/space-insensitive', () => {
    expect(computeInputHash(makeSubject(), { ...ctx, leadEmail: '  MARIO.ROSSI@example.it ' })).toBe(
      computeInputHash(makeSubject(), ctx),
    );
  });

  it('bump di model_version ⇒ hash diverso', () => {
    expect(computeInputHash(makeSubject(), { ...ctx, modelVersion: 2 })).not.toBe(
      computeInputHash(makeSubject(), ctx),
    );
  });

  it('il riordino delle chiavi dell’input è invariante (canonicalizzazione)', () => {
    const s = makeSubject();
    const reversed = Object.fromEntries(Object.entries(s).reverse()) as unknown as SubjectProperty;
    expect(computeInputHash(reversed, ctx)).toBe(computeInputHash(s, ctx));
  });
});
