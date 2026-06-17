import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEnrichDeps } from '@/lib/api/build-enrich-deps';
import { createCatastoProvider, createReconciler, createTranscriber, createVisionExtractor } from './factory';
import { createSupabaseDocumentStore } from './supabase-store';
import type { ProcessDeps } from './process';

/** Assembla le deps dell'orchestratore documenti da un client service-role. */
export async function buildProcessDeps(service: SupabaseClient): Promise<ProcessDeps> {
  return {
    store: createSupabaseDocumentStore(service),
    vision: createVisionExtractor(),
    transcriber: createTranscriber(),
    catasto: createCatastoProvider(),
    reconciler: createReconciler(),
    enrichDeps: await buildEnrichDeps(service),
  };
}
