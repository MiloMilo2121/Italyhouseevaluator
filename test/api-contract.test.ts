import { describe, it, expect } from 'vitest';
import { handleValuation, type HandleValuationDeps } from '@/lib/api/handle-valuation';
import { POST } from '@/app/api/valutazione/route';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { ZONE_A } from './fixtures/omi-zones.fixture';
import { emptyComparablesProvider } from '@/lib/valuation/comparables-empty';
import {
  FakeValuationPersistence,
  RecordingEmailSender,
  ThrowingOmiResolver,
  makeRequestInput,
} from './fixtures/api.fixture';

function makeDeps(overrides: Partial<HandleValuationDeps> = {}): HandleValuationDeps {
  return {
    persistence: new FakeValuationPersistence(),
    loadCoefficientSet: async () => defaultCoefficientSet,
    omiResolver: new FakeOmiResolver([ZONE_A]),
    comparablesProvider: emptyComparablesProvider,
    emailSender: new RecordingEmailSender(),
    modelVersion: 1,
    agentEmail: 'agenti@delfino.it',
    ...overrides,
  };
}

describe('contratto API — insert-prima-di-enrich (§4, §9)', () => {
  it('enrich fallisce ⇒ il lead resta salvato, niente update, risposta comunque valida', async () => {
    const persistence = new FakeValuationPersistence();
    const result = await handleValuation(
      makeRequestInput(),
      makeDeps({ persistence, omiResolver: new ThrowingOmiResolver() }),
    );

    expect(result.referenceId).toMatch(/^VAL-[0-9A-F]{8}$/);
    expect(persistence.leads).toHaveLength(1); // lead COMMITTED prima dell'enrich
    expect(persistence.requests).toHaveLength(1);
    expect(persistence.updates).toHaveLength(0); // enrich fallito ⇒ nessun update
  });

  it('email fallisce ⇒ enrichment salvato, risposta comunque valida (mai 5xx per email)', async () => {
    const persistence = new FakeValuationPersistence();
    const result = await handleValuation(
      makeRequestInput(),
      makeDeps({ persistence, emailSender: new RecordingEmailSender(true) }),
    );

    expect(result.referenceId).toMatch(/^VAL-/);
    expect(persistence.updates).toHaveLength(1);
    expect(persistence.updates[0]!.result.estimate_min).toBe(312375); // worked example
  });

  it('happy path ⇒ update enrichment + due email (scheda agente + conferma lead)', async () => {
    const persistence = new FakeValuationPersistence();
    const emailSender = new RecordingEmailSender();
    await handleValuation(makeRequestInput(), makeDeps({ persistence, emailSender }));

    expect(persistence.updates).toHaveLength(1);
    expect(emailSender.sent).toHaveLength(2);
    expect(emailSender.sent[0]!.to).toBe('agenti@delfino.it'); // scheda agente
    expect(emailSender.sent[0]!.html).toContain('PRIORITÀ'); // intent vendere_ora
    expect(emailSender.sent[1]!.to).toBe('mario.rossi@example.it'); // conferma lead
  });

  it('idempotenza: re-submit (created=false) ⇒ niente enrich/email, stesso reference_id', async () => {
    const persistence = new FakeValuationPersistence({ created: false, existingReferenceId: 'VAL-EXISTING' });
    const emailSender = new RecordingEmailSender();
    const result = await handleValuation(
      makeRequestInput(),
      makeDeps({ persistence, emailSender, omiResolver: new ThrowingOmiResolver() }),
    );

    expect(result.referenceId).toBe('VAL-EXISTING');
    expect(persistence.updates).toHaveLength(0);
    expect(emailSender.sent).toHaveLength(0);
  });
});

describe('route POST /api/valutazione — validazione', () => {
  const url = 'http://localhost/api/valutazione';

  it('body JSON non valido ⇒ 400', async () => {
    const res = await POST(new Request(url, { method: 'POST', body: 'non-json' }));
    expect(res.status).toBe(400);
  });

  it('consent_privacy = false ⇒ 400 (rifiuto a monte, prima di toccare DB)', async () => {
    const body = JSON.stringify({ ...rawValid(), consent_privacy: false });
    const res = await POST(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }));
    expect(res.status).toBe(400);
  });
});

function rawValid(): Record<string, unknown> {
  return {
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
}
