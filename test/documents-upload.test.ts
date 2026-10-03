import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/documenti/upload/route';

const mockCreateSignedUploadUrl = vi.fn();
const mockUpload = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db/client', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'valuation_requests') {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === 'valuation_documents') {
        return {
          insert: mockInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        upload: mockUpload,
      }),
    },
  }),
}));

describe('POST /api/documenti/upload — Direct-to-Storage & Multipart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modalità JSON (Direct-to-Storage)', () => {
    it('rifiuta JSON malformato con 400', async () => {
      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json',
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Body JSON non valido');
    });

    it('prepare: rifiuta reference_id mancante con 400', async () => {
      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            kind: 'planimetria',
            mime: 'application/pdf',
            byte_size: 1000,
          }),
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('reference_id mancante');
    });

    it('prepare: rifiuta kind non valido con 400', async () => {
      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            reference_id: 'ref-1',
            kind: 'invalid-kind',
            mime: 'application/pdf',
            byte_size: 1000,
          }),
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('kind non valido');
    });

    it('prepare: rifiuta file che eccede il limite dimensionale con 400', async () => {
      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            reference_id: 'ref-1',
            kind: 'planimetria',
            mime: 'application/pdf',
            byte_size: 30 * 1024 * 1024, // 30 MB > 20 MB
          }),
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('File troppo grande');
    });

    it('prepare: restituisce 404 se la reference_id non esiste', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            reference_id: 'ref-inexistent',
            kind: 'planimetria',
            mime: 'application/pdf',
            byte_size: 5000,
          }),
        }),
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('valutazione non trovata');
    });

    it('prepare: genera signed upload URL e token se input valido', async () => {
      mockSingle.mockResolvedValueOnce({ data: { reference_id: 'ref-1' }, error: null });
      mockCreateSignedUploadUrl.mockResolvedValueOnce({
        data: {
          signedUrl: 'https://supabase.co/storage/v1/upload/sign/ref-1/planimetria/doc-123?token=tok-abc',
          token: 'tok-abc',
          path: 'ref-1/planimetria/doc-123',
        },
        error: null,
      });

      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            reference_id: 'ref-1',
            kind: 'planimetria',
            mime: 'application/pdf',
            byte_size: 5000,
          }),
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.signedUrl).toContain('tok-abc');
      expect(json.token).toBe('tok-abc');
      expect(json.id).toBeDefined();
      expect(json.path).toContain('ref-1/planimetria/');
    });

    it('confirm: rifiuta mismatch nel percorso (path traversal guard)', async () => {
      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm',
            id: 'doc-123',
            reference_id: 'ref-1',
            kind: 'planimetria',
            path: 'other-ref/planimetria/doc-123',
            mime: 'application/pdf',
            byte_size: 5000,
          }),
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('percorso file non valido');
    });

    it('confirm: inserisce riga in valuation_documents e ritorna 200', async () => {
      mockSingle.mockResolvedValueOnce({ data: { reference_id: 'ref-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: null });

      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm',
            id: 'doc-123',
            reference_id: 'ref-1',
            kind: 'planimetria',
            path: 'ref-1/planimetria/doc-123',
            mime: 'application/pdf',
            byte_size: 5000,
            uploaded_by: 'seller',
          }),
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('uploaded');
      expect(json.id).toBe('doc-123');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'doc-123',
          reference_id: 'ref-1',
          kind: 'planimetria',
          storage_path: 'ref-1/planimetria/doc-123',
          status: 'uploaded',
          uploaded_by: 'seller',
        }),
      );
    });
  });

  describe('Modalità Multipart Fallback', () => {
    it('rifiuta richiesta multipart con campi mancanti con 400', async () => {
      const fd = new FormData();
      fd.append('reference_id', 'ref-1');
      // missing kind and file

      const res = await POST(
        new Request('http://localhost/api/documenti/upload', {
          method: 'POST',
          body: fd,
        }),
      );
      expect(res.status).toBe(400);
    });
  });
});
