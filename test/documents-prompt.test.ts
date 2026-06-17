import { describe, it, expect } from 'vitest';
import {
  APE_SYSTEM,
  ApeSchema,
  buildReconcilerUserContent,
  PLANIMETRIA_SYSTEM,
  PlanimetriaSchema,
  RECONCILER_JSON_SCHEMA,
  RECONCILER_SYSTEM,
  ReconciliationSchema,
} from '@/lib/documents/prompt';
import { OVERRIDE_FIELDS } from '@/lib/documents/types';

describe('prompt grounding', () => {
  it('i system prompt vietano di inventare e impongono "solo leggibile"', () => {
    expect(APE_SYSTEM).toMatch(/NON inventare/);
    expect(APE_SYSTEM).toMatch(/leggibil/i);
    expect(PLANIMETRIA_SYSTEM).toMatch(/NON inventare/);
    expect(PLANIMETRIA_SYSTEM).toMatch(/leggibil/i);
    expect(RECONCILER_SYSTEM).toMatch(/NON inventare/);
    expect(RECONCILER_SYSTEM).toMatch(/NON proporre stime/i);
  });

  it('lo schema reconciler vincola override.field alla whitelist', () => {
    const schema = RECONCILER_JSON_SCHEMA as unknown as {
      properties: { overrides: { items: { properties: { field: { enum: string[] } } } } };
    };
    expect(schema.properties.overrides.items.properties.field.enum).toEqual([...OVERRIDE_FIELDS]);
  });

  it('gli zod schema accettano payload validi', () => {
    expect(
      ApeSchema.safeParse({ classeEnergetica: 'C', epglNrenKwhMqAnno: 120, leggibile: true, confidence: 'alta' })
        .success,
    ).toBe(true);
    expect(
      PlanimetriaSchema.safeParse({
        vani: 4,
        superficieCalpestabileMq: null,
        locali: ['cucina'],
        leggibile: true,
        confidence: 'media',
      }).success,
    ).toBe(true);
    expect(ReconciliationSchema.safeParse({ overrides: [], dubbi: [], sintesi: 'ok' }).success).toBe(true);
  });

  it('gli zod schema rifiutano confidence non valida', () => {
    expect(
      ApeSchema.safeParse({ classeEnergetica: 'C', epglNrenKwhMqAnno: 120, leggibile: true, confidence: 'altissima' })
        .success,
    ).toBe(false);
  });

  it('buildReconcilerUserContent serializza i dati di confronto', () => {
    const txt = buildReconcilerUserContent({
      declared: {
        propertyType: 'appartamento',
        superficieMq: 85,
        condizioni: 'ristrutturata',
        classeEnergetica: 'D',
        piano: 3,
        pianiEdificio: 6,
        ascensore: true,
      },
      ape: null,
      planimetria: null,
      catasto: null,
      voiceNotes: [],
    });
    expect(txt).toContain('"superficieMq": 85');
  });
});
