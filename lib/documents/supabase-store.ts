import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRecord, DocumentStore } from './process';
import { rowToSubjectProperty, type ValuationRequestRow } from './row-to-subject';

/**
 * Implementazione del `DocumentStore` su Supabase (service role): Storage per i
 * file + valuation_documents/valuation_requests per i metadati. Usata sia dalla
 * route /api/documenti/process sia dallo script di batch.
 */

export const DOCUMENTI_BUCKET = 'documenti';

export function createSupabaseDocumentStore(service: SupabaseClient): DocumentStore {
  return {
    async download(path: string): Promise<{ data: string; mime: string }> {
      const { data, error } = await service.storage.from(DOCUMENTI_BUCKET).download(path);
      if (error || !data) throw new Error(`download fallito (${path}): ${error?.message ?? 'nessun dato'}`);
      const buf = Buffer.from(await data.arrayBuffer());
      return { data: buf.toString('base64'), mime: data.type || 'application/octet-stream' };
    },

    async updateDocument(id: string, patch: Record<string, unknown>): Promise<void> {
      const { error } = await service.from('valuation_documents').update(patch).eq('id', id);
      if (error) throw new Error(`updateDocument: ${error.message}`);
    },

    async listDocuments(referenceId: string): Promise<DocumentRecord[]> {
      const { data, error } = await service
        .from('valuation_documents')
        .select('*')
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`listDocuments: ${error.message}`);
      return (data ?? []) as unknown as DocumentRecord[];
    },

    async loadRequest(referenceId: string) {
      const { data, error } = await service
        .from('valuation_requests')
        .select('*')
        .eq('reference_id', referenceId)
        .single();
      if (error || !data) return null;
      const row = data as unknown as ValuationRequestRow & {
        address_normalized: string | null;
        address_raw: string | null;
        comune: string | null;
      };
      return {
        subject: rowToSubjectProperty(row),
        indirizzo: row.address_normalized ?? row.address_raw ?? null,
        comune: row.comune ?? null,
      };
    },

    async saveReconciled(referenceId: string, patch: Record<string, unknown>): Promise<void> {
      const { error } = await service.from('valuation_requests').update(patch).eq('reference_id', referenceId);
      if (error) throw new Error(`saveReconciled: ${error.message}`);
    },
  };
}
