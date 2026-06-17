import type { OmiStato } from '@/lib/valuation/types';

/**
 * Normalizzazioni dei valori grezzi OMI. Pure e testabili.
 */

/**
 * Converte un numero in formato italiano (virgola decimale, eventuale punto
 * migliaia) in number. Stringa vuota → null. Non numerico → null.
 */
export function parseItalianNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Rimuove separatori migliaia '.', poi virgola decimale → punto.
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valore di compravendita: deve essere > 0. 0/vuoto/non valido → null.
 */
export function parseComprValue(raw: string | null | undefined): number | null {
  const n = parseItalianNumber(raw);
  return n != null && n > 0 ? n : null;
}

/**
 * Valore di locazione: ~10% dei dati grezzi è 0 (no dato) → null.
 */
export function parseLocValue(raw: string | null | undefined): number | null {
  const n = parseItalianNumber(raw);
  return n != null && n > 0 ? n : null;
}

/** Normalizza lo stato OMI nell'enum del dominio. Ignoto → null. */
export function parseOmiStato(raw: string | null | undefined): OmiStato | null {
  if (raw == null) return null;
  switch (raw.trim().toUpperCase()) {
    case 'OTTIMO':
      return 'Ottimo';
    case 'NORMALE':
      return 'Normale';
    case 'SCADENTE':
      return 'Scadente';
    default:
      return null;
  }
}

/** Normalizza la fascia OMI (B/C/D/E/R). Ignota → null. */
export function parseFascia(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const f = raw.trim().toUpperCase();
  return ['B', 'C', 'D', 'E', 'R'].includes(f) ? f : null;
}

/** Valida il formato del semestre 'YYYY-S' (S = 1|2). */
export function isValidSemestre(semestre: string): boolean {
  return /^\d{4}-[12]$/.test(semestre.trim());
}
