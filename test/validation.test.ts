import { describe, it, expect } from 'vitest';
import {
  ValuationRequestSchema,
  toLeadInput,
  toSubjectProperty,
  isPriorityIntent,
} from '@/lib/schemas/valuation-request.schema';

const validBody = {
  nome: 'Mario',
  cognome: 'Rossi',
  email: 'mario.rossi@example.it',
  telefono: '3331234567',
  consent_privacy: true,
  intent: 'vendere_ora',
  address_raw: 'Via Roma 1, Milano',
  lat: 45.467,
  lng: 9.19,
  property_type: 'appartamento',
  superficie_mq: 85,
  stanze: 3,
  ascensore: true,
  condizioni: 'ristrutturata',
  piano: 3,
  piani_edificio: 6,
};

describe('contratto API §9 (validazione Zod)', () => {
  it('payload valido ⇒ success', () => {
    expect(ValuationRequestSchema.safeParse(validBody).success).toBe(true);
  });

  it('consent_privacy = false ⇒ reject con path corretto', () => {
    const r = ValuationRequestSchema.safeParse({ ...validBody, consent_privacy: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'consent_privacy')).toBe(true);
    }
  });

  it('i mapper producono SubjectProperty e LeadInput coerenti', () => {
    const parsed = ValuationRequestSchema.parse(validBody);
    const subj = toSubjectProperty(parsed);
    expect(subj.superficieMq).toBe(85);
    expect(subj.hasBalcone).toBe(false); // dotazioni assenti ⇒ default false
    expect(subj.classeEnergetica).toBeNull();

    const lead = toLeadInput(parsed);
    expect(lead.is_priority).toBe(true); // vendere_ora è hot
  });

  it('is_priority: solo gli intenti "ora" sono prioritari', () => {
    expect(isPriorityIntent('vendere_ora')).toBe(true);
    expect(isPriorityIntent('comprare_ora')).toBe(true);
    expect(isPriorityIntent('vendere_dopo')).toBe(false);
    expect(isPriorityIntent('comprare_dopo')).toBe(false);
  });
});
