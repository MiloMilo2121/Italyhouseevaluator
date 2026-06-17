import type { SubjectProperty } from '@/lib/valuation/types';
import {
  OVERRIDE_FIELDS,
  type ConfidenceLevel,
  type DeclaredSubjectFacts,
  type DocumentFacts,
  type OverrideField,
  type ReconciliationDubbio,
  type ReconciliationOverride,
  type ReconciliationResult,
} from './types';

/**
 * Guardrail PURO della riconciliazione (il cuore del principio cardine).
 * L'LLM PROPONE override; qui il CODICE decide deterministicamente cosa applicare:
 *   1) il `field` deve essere nella whitelist (difesa in profondità, anche se il
 *      JSON schema lo vincola già a monte);
 *   2) la `confidence` deve superare la soglia (default: esclude 'bassa');
 *   3) il `value` deve passare un validatore per-campo (enum/tipo/banda).
 * Ciò che non passa diventa un "dubbio" mostrato all'agente — mai applicato in
 * silenzio. `enrich` (motore deterministico) calcolerà poi il numero sul subject
 * corretto: l'LLM non produce mai un prezzo.
 */

export const VALID_PROPERTY_TYPES: readonly string[] = [
  'appartamento',
  'attico',
  'mansarda',
  'casa_indipendente',
  'loft',
  'rustico_casale',
  'villa',
  'villetta_schiera',
];
export const VALID_CONDIZIONI: readonly string[] = [
  'nuova',
  'ristrutturata',
  'parz_ristrutturata',
  'da_ristrutturare',
];
// Scala APE italiana (allineata alle chiavi del coefficient_set seed).
export const VALID_CLASSE_ENERGETICA: readonly string[] = [
  'A4',
  'A3',
  'A2',
  'A1',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
];

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { bassa: 0, media: 1, alta: 2 };
const DEFAULT_MIN_CONFIDENCE: ConfidenceLevel = 'media';
const DEFAULT_SURFACE_BAND = 0.5; // superficie corretta entro ±50% del dichiarato

export interface ApplyReconciliationOptions {
  minConfidence?: ConfidenceLevel;
  surfaceBand?: number;
}

export interface ApplyReconciliationResult {
  correctedSubject: SubjectProperty;
  appliedOverrides: ReconciliationOverride[];
  rejected: ReconciliationDubbio[];
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const cleaned = v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'si', 'sì', 'yes', 'vero'].includes(s)) return true;
  if (['false', '0', 'no', 'falso'].includes(s)) return false;
  return null;
}

type Coerced = { ok: true; value: unknown } | { ok: false; reason: string };

function coerceField(
  field: OverrideField,
  raw: unknown,
  subject: SubjectProperty,
  band: number,
): Coerced {
  switch (field) {
    case 'propertyType': {
      const v = String(raw).trim();
      return VALID_PROPERTY_TYPES.includes(v)
        ? { ok: true, value: v }
        : { ok: false, reason: `tipologia "${v}" non riconosciuta` };
    }
    case 'condizioni': {
      const v = String(raw).trim();
      return VALID_CONDIZIONI.includes(v)
        ? { ok: true, value: v }
        : { ok: false, reason: `stato "${v}" non riconosciuto` };
    }
    case 'classeEnergetica': {
      const v = String(raw).trim().toUpperCase();
      return VALID_CLASSE_ENERGETICA.includes(v)
        ? { ok: true, value: v }
        : { ok: false, reason: `classe energetica "${v}" non valida` };
    }
    case 'ascensore': {
      const v = parseBool(raw);
      return v == null ? { ok: false, reason: `ascensore "${String(raw)}" non interpretabile` } : { ok: true, value: v };
    }
    case 'piano': {
      const n = toNum(raw);
      return n != null && Number.isInteger(n)
        ? { ok: true, value: n }
        : { ok: false, reason: `piano "${String(raw)}" non è un intero` };
    }
    case 'pianiEdificio': {
      const n = toNum(raw);
      return n != null && Number.isInteger(n) && n > 0
        ? { ok: true, value: n }
        : { ok: false, reason: `piani edificio "${String(raw)}" non valido` };
    }
    case 'superficieMq': {
      const n = toNum(raw);
      if (n == null || n <= 0) return { ok: false, reason: `superficie "${String(raw)}" non valida` };
      const declared = subject.superficieMq;
      if (declared > 0) {
        const ratio = n / declared;
        if (ratio < 1 - band || ratio > 1 + band) {
          return { ok: false, reason: `superficie ${n} m² fuori banda rispetto a ${declared} dichiarati` };
        }
      }
      return { ok: true, value: n };
    }
    case 'balconeAreaMq':
    case 'terrazzoAreaMq':
    case 'giardinoAreaMq':
    case 'cantinaAreaMq':
    case 'soffittaAreaMq': {
      const n = toNum(raw);
      return n != null && n >= 0
        ? { ok: true, value: n }
        : { ok: false, reason: `area "${String(raw)}" non valida` };
    }
  }
}

function isOverrideField(f: string): f is OverrideField {
  return (OVERRIDE_FIELDS as readonly string[]).includes(f);
}

/** Applica deterministicamente solo gli override ammessi; il resto → rejected. */
export function applyReconciliation(
  subject: SubjectProperty,
  result: ReconciliationResult,
  opts: ApplyReconciliationOptions = {},
): ApplyReconciliationResult {
  const minRank = CONFIDENCE_RANK[opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE];
  const band = opts.surfaceBand ?? DEFAULT_SURFACE_BAND;

  const corrected: SubjectProperty = { ...subject };
  const appliedOverrides: ReconciliationOverride[] = [];
  const rejected: ReconciliationDubbio[] = [];

  for (const ov of result.overrides) {
    const reject = (reason: string): void => {
      rejected.push({
        campo: String(ov.field),
        dichiarato: (subject as unknown as Record<string, unknown>)[ov.field as string] ?? null,
        rilevato: ov.value ?? null,
        nota: reason,
      });
    };

    if (!isOverrideField(ov.field)) {
      reject('campo non modificabile da documenti');
      continue;
    }
    if (CONFIDENCE_RANK[ov.confidence] < minRank) {
      reject(`confidenza ${ov.confidence} insufficiente per applicare in automatico`);
      continue;
    }
    const coerced = coerceField(ov.field, ov.value, corrected, band);
    if (!coerced.ok) {
      reject(coerced.reason);
      continue;
    }
    (corrected as unknown as Record<string, unknown>)[ov.field] = coerced.value;
    appliedOverrides.push({ ...ov, value: coerced.value });
  }

  return { correctedSubject: corrected, appliedOverrides, rejected };
}

/** Assembla la forma persistita in valuation_requests.document_facts. */
export function buildDocumentFacts(
  result: ReconciliationResult,
  applied: ReconciliationOverride[],
  rejected: ReconciliationDubbio[],
  now: string = new Date().toISOString(),
): DocumentFacts {
  return {
    appliedOverrides: applied,
    dubbi: [...result.dubbi, ...rejected],
    sintesi: result.sintesi,
    generatedAt: now,
  };
}

/** Sottoinsieme dichiarato del subject confrontato dal reconciler (no PII). */
export function toDeclaredFacts(subject: SubjectProperty): DeclaredSubjectFacts {
  return {
    propertyType: subject.propertyType,
    superficieMq: subject.superficieMq,
    condizioni: subject.condizioni,
    classeEnergetica: subject.classeEnergetica,
    piano: subject.piano,
    pianiEdificio: subject.pianiEdificio,
    ascensore: subject.ascensore,
  };
}
