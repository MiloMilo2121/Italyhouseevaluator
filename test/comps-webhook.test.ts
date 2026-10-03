import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/comps/webhook/route';

describe('POST /api/comps/webhook — autenticazione e validazione', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('senza APIFY_WEBHOOK_SECRET configurato, procede al check di APIFY_TOKEN', async () => {
    delete process.env.APIFY_WEBHOOK_SECRET;
    delete process.env.APIFY_TOKEN;

    const res = await POST(new Request('http://localhost/api/comps/webhook', {
      method: 'POST',
      body: JSON.stringify({ resource: { defaultDatasetId: 'dataset-123' } }),
    }));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('APIFY_TOKEN non configurato');
  });

  it('con APIFY_WEBHOOK_SECRET configurato, rifiuta richieste senza secret con 401', async () => {
    process.env.APIFY_WEBHOOK_SECRET = 'segreto-apify-123';
    process.env.APIFY_TOKEN = 'token-123';

    const res = await POST(new Request('http://localhost/api/comps/webhook', {
      method: 'POST',
      body: JSON.stringify({ resource: { defaultDatasetId: 'dataset-123' } }),
    }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Non autorizzato');
  });

  it('con APIFY_WEBHOOK_SECRET errato, rifiuta con 401', async () => {
    process.env.APIFY_WEBHOOK_SECRET = 'segreto-apify-123';
    process.env.APIFY_TOKEN = 'token-123';

    const res = await POST(new Request('http://localhost/api/comps/webhook?secret=segreto-errato', {
      method: 'POST',
      body: JSON.stringify({ resource: { defaultDatasetId: 'dataset-123' } }),
    }));

    expect(res.status).toBe(401);
  });

  it('con secret corretto in query param e token assente, passa la guardia secret (503)', async () => {
    process.env.APIFY_WEBHOOK_SECRET = 'segreto-apify-123';
    delete process.env.APIFY_TOKEN;

    const res = await POST(new Request('http://localhost/api/comps/webhook?secret=segreto-apify-123', {
      method: 'POST',
      body: JSON.stringify({ resource: { defaultDatasetId: 'dataset-123' } }),
    }));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('APIFY_TOKEN non configurato');
  });

  it('con secret corretto in header x-apify-webhook-secret e token assente, passa la guardia secret (503)', async () => {
    process.env.APIFY_WEBHOOK_SECRET = 'segreto-apify-123';
    delete process.env.APIFY_TOKEN;

    const res = await POST(new Request('http://localhost/api/comps/webhook', {
      method: 'POST',
      headers: {
        'x-apify-webhook-secret': 'segreto-apify-123',
      },
      body: JSON.stringify({ resource: { defaultDatasetId: 'dataset-123' } }),
    }));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('APIFY_TOKEN non configurato');
  });
});
