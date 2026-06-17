import type { CatastoData } from './types';

/**
 * Mapping PURO del payload Catasto (forma di terze parti, sconosciuta a priori)
 * → `CatastoData` tipato. Difensivo: accetta diversi alias di chiave e degrada a
 * null sui campi mancanti. Tutto il rischio "shape del provider" vive qui ed è
 * testato su una fixture controllata; l'adapter resta un thin client HTTP.
 */

function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function str(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function numOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      // tollera separatori italiani: "1.234,56" → 1234.56
      const cleaned = v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function normalizeCatasto(raw: unknown): CatastoData {
  const r = asRecord(raw);
  const ident = asRecord(r['identificativo'] ?? r['identificativi'] ?? r);

  return {
    categoria: str(r['categoria'], r['category'], r['classamento']),
    classe: str(r['classe'], r['class']),
    consistenzaVani: numOrNull(r['consistenza'], r['vani'], r['consistenza_vani']),
    renditaEuro: numOrNull(r['rendita'], r['rendita_euro'], r['renditaCatastale']),
    superficieCatastaleMq: numOrNull(
      r['superficie_catastale'],
      r['superficieCatastale'],
      r['superficie'],
    ),
    foglio: str(ident['foglio'], r['foglio']),
    particella: str(ident['particella'], r['particella'], ident['mappale']),
    subalterno: str(ident['subalterno'], r['subalterno'], ident['sub']),
  };
}
