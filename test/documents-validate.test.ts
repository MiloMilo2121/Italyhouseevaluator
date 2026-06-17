import { describe, it, expect } from 'vitest';
import { validateUpload } from '@/lib/documents/validate';

describe('validateUpload', () => {
  it('accetta immagini e PDF per planimetria/ape', () => {
    expect(validateUpload('planimetria', 'application/pdf', 1000).ok).toBe(true);
    expect(validateUpload('ape', 'image/png', 1000).ok).toBe(true);
    expect(validateUpload('planimetria', 'image/jpeg', 1000).ok).toBe(true);
  });

  it('accetta audio per nota_vocale', () => {
    expect(validateUpload('nota_vocale', 'audio/mpeg', 1000).ok).toBe(true);
    expect(validateUpload('nota_vocale', 'audio/webm', 1000).ok).toBe(true);
  });

  it('rifiuta mime incoerente col kind', () => {
    expect(validateUpload('planimetria', 'audio/mpeg', 1000).ok).toBe(false);
    expect(validateUpload('nota_vocale', 'application/pdf', 1000).ok).toBe(false);
  });

  it('rifiuta un kind sconosciuto', () => {
    expect(validateUpload('foo', 'image/png', 1000).ok).toBe(false);
  });

  it('rifiuta file vuoti o troppo grandi', () => {
    expect(validateUpload('ape', 'application/pdf', 0).ok).toBe(false);
    expect(validateUpload('ape', 'application/pdf', 21 * 1024 * 1024).ok).toBe(false);
    expect(validateUpload('nota_vocale', 'audio/mpeg', 26 * 1024 * 1024).ok).toBe(false);
  });
});
