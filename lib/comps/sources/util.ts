/** Coercizioni difensive condivise dagli adapter delle fonti ufficiali (puro). */

export function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export function str(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Numero tollerante: numeri JS diretti; stringhe decimali "45.46" (lat/lng) lette
 * così come sono; formati IT "250.000,50" normalizzati. Non mangia i decimali.
 */
export function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const t = v.trim();
      if (/^-?\d+(\.\d+)?$/.test(t)) {
        const n = Number(t);
        if (Number.isFinite(n)) return n;
      }
      const cleaned = t.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function bool(...vals: unknown[]): boolean | null {
  for (const v of vals) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true', '1', 'si', 'sì', 'yes'].includes(s)) return true;
      if (['false', '0', 'no'].includes(s)) return false;
    }
  }
  return null;
}
