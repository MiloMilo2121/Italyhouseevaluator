import { describe, it, expect } from 'vitest';
import { toApiPayload } from '@/lib/funnel/to-api-payload';
import { ValuationRequestSchema } from '@/lib/schemas/valuation-request.schema';
import { makeFunnelData } from './fixtures/funnel.fixture';
import type { FunnelData } from '@/lib/funnel/types';

describe('toApiPayload → contratto §9 (keystone M5)', () => {
  it('un FunnelData completo produce un body che PASSA ValuationRequestSchema', () => {
    const parsed = ValuationRequestSchema.safeParse(toApiPayload(makeFunnelData()));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dotazioni.balcone).toBe(false);
      expect(parsed.data.anni_ristrutturazione).toBe('<5');
      expect(typeof parsed.data.lat).toBe('number');
    }
  });

  it('gli step opzionali saltati sono ASSENTI dal payload (schema .optional() soddisfatto)', () => {
    const payload = toApiPayload(makeFunnelData()) as Record<string, unknown>;
    expect('riscaldamento' in payload).toBe(false);
    expect('classe_energetica' in payload).toBe(false);
    expect(ValuationRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('condizioni=nuova ⇒ anni_ristrutturazione assente, schema valido', () => {
    const d = makeFunnelData({ condizioni: 'nuova' });
    delete (d as Partial<FunnelData>).anni_ristrutturazione;
    const payload = toApiPayload(d) as Record<string, unknown>;
    expect('anni_ristrutturazione' in payload).toBe(false);
    expect(ValuationRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('consent_privacy=false ⇒ il body è rifiutato dallo schema', () => {
    const payload = toApiPayload(makeFunnelData({ consent_privacy: false }));
    expect(ValuationRequestSchema.safeParse(payload).success).toBe(false);
  });
});
