import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { enrichResultToUpdate } from '@/lib/db/valuations';
import type { SubjectProperty } from '@/lib/valuation/types';
import { applyReconciliation, buildDocumentFacts, toDeclaredFacts } from './reconcile';
import type {
  ApeExtraction,
  CatastoProvider,
  DocumentKind,
  DocumentReconciler,
  DocumentStatus,
  DocumentVisionExtractor,
  PlanimetriaExtraction,
  Transcriber,
  VoiceNoteExtraction,
} from './types';

/**
 * Orchestratore del pipeline documenti (deps INIETTATE → testabile con fake e
 * condiviso tra la route /api/documenti/process e lo script di batch). Non
 * conosce Supabase/Storage direttamente: lavora su un `DocumentStore` astratto.
 *
 *  - extract: per ogni documento 'uploaded' scarica il file e chiama il giusto
 *    estrattore (vision/whisper); flippa lo status per documento (partial-safe).
 *  - reconcile: SOLO quando tutti i doc sono terminali; raccoglie i fatti +
 *    catasto, chiama il reconciler LLM, applica il GUARDRAIL puro, e — se ci
 *    sono override applicati — RI-ESEGUE `enrich` (motore deterministico) sul
 *    subject corretto. Persiste catasto + document_facts (+ enrichment).
 *  - revert: ricalcola `enrich` dal subject dichiarato originale e azzera i
 *    fatti documentali (ricalcolo lato sistema, non edit di colonna agente).
 */

export interface DocumentRecord {
  id: string;
  kind: DocumentKind;
  storage_path: string;
  mime: string | null;
  status: DocumentStatus;
  extraction: unknown;
  transcript: string | null;
}

export interface RequestForReconcile {
  subject: SubjectProperty;
  indirizzo: string | null;
  comune: string | null;
}

/** I/O astratto (storage + DB) iniettato: la route lo implementa col service client. */
export interface DocumentStore {
  download(path: string): Promise<{ data: string; mime: string }>;
  updateDocument(id: string, patch: Record<string, unknown>): Promise<void>;
  listDocuments(referenceId: string): Promise<DocumentRecord[]>;
  loadRequest(referenceId: string): Promise<RequestForReconcile | null>;
  saveReconciled(referenceId: string, patch: Record<string, unknown>): Promise<void>;
}

export interface ProcessDeps {
  store: DocumentStore;
  vision: DocumentVisionExtractor;
  transcriber: Transcriber;
  catasto: CatastoProvider;
  reconciler: DocumentReconciler;
  enrichDeps: EnrichDeps;
  now?: () => string;
}

const TERMINAL: DocumentStatus[] = ['extracted', 'failed'];

function nowIso(deps: ProcessDeps): string {
  return deps.now ? deps.now() : new Date().toISOString();
}

/** Estrae un singolo documento (download + estrattore per tipo) e ne persiste l'esito. */
export async function extractDocument(doc: DocumentRecord, deps: ProcessDeps): Promise<DocumentStatus> {
  try {
    await deps.store.updateDocument(doc.id, { status: 'processing' });
    const file = await deps.store.download(doc.storage_path);

    let extraction: unknown = null;
    let transcript: string | null = null;

    if (doc.kind === 'ape') {
      extraction = await deps.vision.extractApe(file);
    } else if (doc.kind === 'planimetria') {
      extraction = await deps.vision.extractPlanimetria(file);
    } else {
      const v = await deps.transcriber.transcribe(file);
      extraction = v;
      transcript = v?.transcript ?? null;
    }

    if (extraction == null) {
      await deps.store.updateDocument(doc.id, {
        status: 'failed',
        error: 'Estrazione non disponibile (LLM/Whisper non configurato o output non valido).',
        processed_at: nowIso(deps),
      });
      return 'failed';
    }

    await deps.store.updateDocument(doc.id, {
      status: 'extracted',
      extraction,
      transcript,
      error: null,
      processed_at: nowIso(deps),
    });
    return 'extracted';
  } catch (e) {
    await deps.store.updateDocument(doc.id, {
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
      processed_at: nowIso(deps),
    });
    return 'failed';
  }
}

export interface ExtractSummary {
  processed: number;
  extracted: number;
  failed: number;
  pending: number;
}

/** Estrae tutti i documenti ancora 'uploaded' di una reference (idempotente). */
export async function extractPending(referenceId: string, deps: ProcessDeps): Promise<ExtractSummary> {
  const docs = await deps.store.listDocuments(referenceId);
  let extracted = 0;
  let failed = 0;
  let processed = 0;
  for (const doc of docs) {
    if (doc.status !== 'uploaded') continue;
    processed += 1;
    const status = await extractDocument(doc, deps);
    if (status === 'extracted') extracted += 1;
    else failed += 1;
  }
  const after = await deps.store.listDocuments(referenceId);
  const pending = after.filter((d) => !TERMINAL.includes(d.status)).length;
  return { processed, extracted, failed, pending };
}

export interface ReconcileSummary {
  reconciled: boolean;
  pending: number;
  appliedOverrides: number;
  dubbi: number;
  reEnriched: boolean;
}

function latestExtraction<T>(docs: DocumentRecord[], kind: DocumentKind): T | null {
  const hit = docs.filter((d) => d.kind === kind && d.status === 'extracted' && d.extraction != null).pop();
  return hit ? (hit.extraction as T) : null;
}

/**
 * Riconcilia i fatti documentali col dichiarato e, se utile, ri-arricchisce.
 * Gated: nessun documento deve essere ancora non-terminale.
 */
export async function reconcileReference(referenceId: string, deps: ProcessDeps): Promise<ReconcileSummary> {
  const docs = await deps.store.listDocuments(referenceId);
  const pending = docs.filter((d) => !TERMINAL.includes(d.status)).length;
  if (pending > 0) {
    return { reconciled: false, pending, appliedOverrides: 0, dubbi: 0, reEnriched: false };
  }

  const request = await deps.store.loadRequest(referenceId);
  if (request == null) {
    return { reconciled: false, pending: 0, appliedOverrides: 0, dubbi: 0, reEnriched: false };
  }

  const ape = latestExtraction<ApeExtraction>(docs, 'ape');
  const planimetria = latestExtraction<PlanimetriaExtraction>(docs, 'planimetria');
  const voiceNotes = docs
    .filter((d) => d.kind === 'nota_vocale' && d.status === 'extracted' && d.extraction != null)
    .map((d) => d.extraction as VoiceNoteExtraction);

  const catasto = await deps.catasto.lookup({ indirizzo: request.indirizzo, comune: request.comune });

  const reconciliation = await deps.reconciler.reconcile({
    declared: toDeclaredFacts(request.subject),
    ape,
    planimetria,
    catasto,
    voiceNotes,
  });

  const patch: Record<string, unknown> = {
    catasto,
    documenti_status: 'reconciled',
  };

  let appliedCount = 0;
  let dubbiCount = 0;
  let reEnriched = false;

  if (reconciliation != null) {
    const applied = applyReconciliation(request.subject, reconciliation);
    const facts = buildDocumentFacts(reconciliation, applied.appliedOverrides, applied.rejected, nowIso(deps));
    patch['document_facts'] = facts;
    appliedCount = applied.appliedOverrides.length;
    dubbiCount = facts.dubbi.length;

    if (appliedCount > 0) {
      const result = await enrich(applied.correctedSubject, deps.enrichDeps);
      Object.assign(patch, enrichResultToUpdate(result));
      reEnriched = true;
    }
  }

  await deps.store.saveReconciled(referenceId, patch);
  return { reconciled: true, pending: 0, appliedOverrides: appliedCount, dubbi: dubbiCount, reEnriched };
}

/** Ripristina la stima dal subject dichiarato originale e azzera i fatti documentali. */
export async function revertReference(referenceId: string, deps: ProcessDeps): Promise<boolean> {
  const request = await deps.store.loadRequest(referenceId);
  if (request == null) return false;
  const result = await enrich(request.subject, deps.enrichDeps);
  await deps.store.saveReconciled(referenceId, {
    ...enrichResultToUpdate(result),
    catasto: null,
    document_facts: null,
    documenti_status: null,
  });
  return true;
}
