import type {
  ApeExtraction,
  CatastoData,
  CatastoProvider,
  CatastoQuery,
  DocumentFile,
  DocumentReconciler,
  DocumentVisionExtractor,
  PlanimetriaExtraction,
  ReconcilerInput,
  ReconciliationResult,
  Transcriber,
  VoiceNoteExtraction,
} from './types';

/**
 * Implementazioni di degrado: senza le chiavi configurate ritornano `null`,
 * così il pipeline documenti resta inerte e il resto del sistema gira (come
 * `NullNarrator`). Le `Mock*` ritornano fixture fisse per build/test.
 */

export class NullVisionExtractor implements DocumentVisionExtractor {
  async extractApe(_file: DocumentFile): Promise<ApeExtraction | null> {
    return null;
  }
  async extractPlanimetria(_file: DocumentFile): Promise<PlanimetriaExtraction | null> {
    return null;
  }
}

export class NullTranscriber implements Transcriber {
  async transcribe(_file: DocumentFile): Promise<VoiceNoteExtraction | null> {
    return null;
  }
}

export class NullCatastoProvider implements CatastoProvider {
  async lookup(_query: CatastoQuery): Promise<CatastoData | null> {
    return null;
  }
}

export class NullReconciler implements DocumentReconciler {
  async reconcile(_input: ReconcilerInput): Promise<ReconciliationResult | null> {
    return null;
  }
}

export class MockCatastoProvider implements CatastoProvider {
  constructor(private readonly data: CatastoData | null) {}
  async lookup(_query: CatastoQuery): Promise<CatastoData | null> {
    return this.data;
  }
}

export class MockReconciler implements DocumentReconciler {
  constructor(private readonly result: ReconciliationResult | null) {}
  async reconcile(_input: ReconcilerInput): Promise<ReconciliationResult | null> {
    return this.result;
  }
}
