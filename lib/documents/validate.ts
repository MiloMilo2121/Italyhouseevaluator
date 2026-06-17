import type { DocumentKind } from './types';

/**
 * Validazione PURA degli upload (lato server, prima di toccare lo Storage).
 * Allowlist MIME + cap di dimensione per tipo. Difesa in profondità: il bucket
 * è privato e la scrittura è service-role, ma validiamo comunque qui.
 */

export const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20 MB (planimetria/APE: immagini/PDF)
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB (limite trascrizione Whisper)

export const ALLOWED_DOC_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const ALLOWED_AUDIO_MIME = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/m4a',
  'audio/x-m4a',
];

const KINDS: readonly DocumentKind[] = ['planimetria', 'ape', 'nota_vocale'];

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v);
}

export function validateUpload(kind: string, mime: string, byteSize: number): ValidateResult {
  if (!isDocumentKind(kind)) {
    return { ok: false, error: 'Tipo di documento non valido.' };
  }
  const isAudio = kind === 'nota_vocale';
  const allowed = isAudio ? ALLOWED_AUDIO_MIME : ALLOWED_DOC_MIME;
  const max = isAudio ? MAX_AUDIO_BYTES : MAX_DOC_BYTES;

  if (!allowed.includes(mime)) {
    return { ok: false, error: `Formato "${mime}" non ammesso per ${kind}.` };
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return { ok: false, error: 'File vuoto o dimensione non valida.' };
  }
  if (byteSize > max) {
    return { ok: false, error: `File troppo grande (max ${Math.round(max / 1024 / 1024)} MB).` };
  }
  return { ok: true };
}
