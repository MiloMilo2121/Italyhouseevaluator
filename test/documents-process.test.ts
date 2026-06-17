import { describe, it, expect } from 'vitest';
import {
  extractPending,
  reconcileReference,
  revertReference,
  type DocumentRecord,
  type DocumentStore,
  type ProcessDeps,
  type RequestForReconcile,
} from '@/lib/documents/process';
import { MockCatastoProvider, MockReconciler, NullReconciler } from '@/lib/documents/null';
import type { DocumentVisionExtractor, Transcriber } from '@/lib/documents/types';
import type { EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { ZONE_A } from './fixtures/omi-zones.fixture';
import { emptyComparablesProvider } from '@/lib/valuation/comparables-empty';
import { makeSubject } from './fixtures/subjects.fixture';
import { makeApeExtraction, makeCatasto, makePlanimetria, makeReconciliation } from './fixtures/documents.fixture';

function enrichDeps(): EnrichDeps {
  return {
    coefficientSet: defaultCoefficientSet,
    omiResolver: new FakeOmiResolver([ZONE_A]),
    comparablesProvider: emptyComparablesProvider,
  };
}

const vision: DocumentVisionExtractor = {
  async extractApe() {
    return makeApeExtraction({ classeEnergetica: 'C' });
  },
  async extractPlanimetria() {
    return makePlanimetria();
  },
};
const transcriber: Transcriber = {
  async transcribe() {
    return { transcript: 'Bagno rifatto.', sintesi: 'ok', puntiChiave: ['bagno'] };
  },
};

class FakeStore implements DocumentStore {
  saved: Record<string, unknown> | null = null;
  constructor(
    public docs: DocumentRecord[],
    private readonly request: RequestForReconcile | null,
  ) {}
  async download(): Promise<{ data: string; mime: string }> {
    return { data: 'AA==', mime: 'image/png' };
  }
  async updateDocument(id: string, patch: Record<string, unknown>): Promise<void> {
    this.docs = this.docs.map((d) => (d.id === id ? ({ ...d, ...patch } as DocumentRecord) : d));
  }
  async listDocuments(): Promise<DocumentRecord[]> {
    return this.docs;
  }
  async loadRequest(): Promise<RequestForReconcile | null> {
    return this.request;
  }
  async saveReconciled(_ref: string, patch: Record<string, unknown>): Promise<void> {
    this.saved = patch;
  }
}

function doc(over: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: 'd1',
    kind: 'ape',
    storage_path: 'ref/ape/x',
    mime: 'application/pdf',
    status: 'uploaded',
    extraction: null,
    transcript: null,
    ...over,
  };
}

function deps(store: FakeStore, over: Partial<ProcessDeps> = {}): ProcessDeps {
  return {
    store,
    vision,
    transcriber,
    catasto: new MockCatastoProvider(makeCatasto()),
    reconciler: new MockReconciler(makeReconciliation()),
    enrichDeps: enrichDeps(),
    now: () => '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('extractPending', () => {
  it('estrae i documenti "uploaded" e flippa lo status (partial-safe)', async () => {
    const store = new FakeStore([doc({ id: 'd1', kind: 'ape' })], null);
    const out = await extractPending('ref', deps(store));
    expect(out).toEqual({ processed: 1, extracted: 1, failed: 0, pending: 0 });
    const d = store.docs[0]!;
    expect(d.status).toBe('extracted');
    expect((d.extraction as { classeEnergetica: string }).classeEnergetica).toBe('C');
  });

  it('è idempotente: non rilavora documenti già terminali', async () => {
    const store = new FakeStore([doc({ id: 'd1', status: 'extracted', extraction: makeApeExtraction() })], null);
    const out = await extractPending('ref', deps(store));
    expect(out.processed).toBe(0);
  });

  it('marca failed quando l’estrattore ritorna null', async () => {
    const nullVision: DocumentVisionExtractor = {
      async extractApe() {
        return null;
      },
      async extractPlanimetria() {
        return null;
      },
    };
    const store = new FakeStore([doc({ id: 'd1', kind: 'ape' })], null);
    const out = await extractPending('ref', deps(store, { vision: nullVision }));
    expect(out.failed).toBe(1);
    expect(store.docs[0]!.status).toBe('failed');
  });
});

describe('reconcileReference', () => {
  const request: RequestForReconcile = {
    subject: makeSubject({ classeEnergetica: 'D' }),
    indirizzo: 'Via Test 1',
    comune: 'Milano',
  };

  it('è gated: non riconcilia se restano documenti non terminali', async () => {
    const store = new FakeStore([doc({ id: 'd1', status: 'uploaded' })], request);
    const out = await reconcileReference('ref', deps(store));
    expect(out.reconciled).toBe(false);
    expect(out.pending).toBe(1);
    expect(store.saved).toBeNull();
  });

  it('applica gli override affidabili e RI-arricchisce sul subject corretto', async () => {
    const store = new FakeStore(
      [doc({ id: 'd1', kind: 'ape', status: 'extracted', extraction: makeApeExtraction({ classeEnergetica: 'C' }) })],
      request,
    );
    const out = await reconcileReference('ref', deps(store));
    expect(out.reconciled).toBe(true);
    expect(out.appliedOverrides).toBe(1);
    expect(out.reEnriched).toBe(true);
    const patch = store.saved!;
    expect(patch['documenti_status']).toBe('reconciled');
    expect(patch['catasto']).not.toBeNull();
    // enrich rieseguito con classe C (1.015), non con la dichiarata D (1.0).
    const coeff = patch['coefficients_applied'] as Record<string, number>;
    expect(coeff['classe_energetica']).toBe(1.015);
    expect(patch['estimate_min']).not.toBeNull();
  });

  it('senza reconciler (Null) salva catasto ma non ri-arricchisce', async () => {
    const store = new FakeStore([doc({ id: 'd1', status: 'extracted', extraction: makeApeExtraction() })], request);
    const out = await reconcileReference('ref', deps(store, { reconciler: new NullReconciler() }));
    expect(out.reconciled).toBe(true);
    expect(out.reEnriched).toBe(false);
    expect(store.saved!['document_facts']).toBeUndefined();
    expect(store.saved!['documenti_status']).toBe('reconciled');
  });
});

describe('revertReference', () => {
  it('ricalcola dal dichiarato originale e azzera i fatti documentali', async () => {
    const request: RequestForReconcile = {
      subject: makeSubject({ classeEnergetica: 'D' }),
      indirizzo: null,
      comune: null,
    };
    const store = new FakeStore([], request);
    const ok = await revertReference('ref', deps(store));
    expect(ok).toBe(true);
    const patch = store.saved!;
    expect(patch['document_facts']).toBeNull();
    expect(patch['documenti_status']).toBeNull();
    const coeff = patch['coefficients_applied'] as Record<string, number>;
    expect(coeff['classe_energetica']).toBe(1.0); // classe dichiarata D
  });
});
