import { createHash } from 'node:crypto';
import type { SubjectProperty } from './types';

/**
 * Idempotenza (§9). L'hash è calcolato su uno snapshot CANONICALIZZATO
 * dell'input + email del lead + versioni (coeff/model). Stesso input ⇒ stesso
 * hash ⇒ stesso reference_id/stima; bump di model/coeff version ⇒ hash diverso;
 * email diversa ⇒ hash diverso (no collisioni tra lead distinti).
 */

export interface HashContext {
  leadEmail: string;
  coefficientSetId: string;
  coefficientSetVersion: number;
  modelVersion: number;
}

/** Stringify deterministica: chiavi ordinate ricorsivamente. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Snapshot a forma fissa: undefined/assente → null, così l'hash è stabile. */
function normalizeSubject(s: SubjectProperty): Record<string, unknown> {
  return {
    propertyType: s.propertyType,
    superficieMq: s.superficieMq,
    stanze: s.stanze ?? null,
    ascensore: s.ascensore,
    hasBalcone: s.hasBalcone,
    hasGarage: s.hasGarage,
    hasGiardino: s.hasGiardino,
    condizioni: s.condizioni,
    anniRistrutturazione: s.anniRistrutturazione ?? null,
    piano: s.piano ?? null,
    pianoLabel: s.pianoLabel ?? null,
    pianiEdificio: s.pianiEdificio ?? null,
    riscaldamento: s.riscaldamento ?? null,
    classeEnergetica: s.classeEnergetica ?? null,
    lat: s.location.lat,
    lng: s.location.lng,
    comuneCode: s.comuneCode ?? null,
    balconeAreaMq: s.balconeAreaMq ?? null,
    balconeCoperto: s.balconeCoperto ?? null,
    terrazzoAreaMq: s.terrazzoAreaMq ?? null,
    giardinoAreaMq: s.giardinoAreaMq ?? null,
    cantinaAreaMq: s.cantinaAreaMq ?? null,
    soffittaAreaMq: s.soffittaAreaMq ?? null,
  };
}

export function computeInputHash(subject: SubjectProperty, ctx: HashContext): string {
  const canonical = {
    subject: normalizeSubject(subject),
    leadEmail: ctx.leadEmail.trim().toLowerCase(),
    coefficientSetId: ctx.coefficientSetId,
    coefficientSetVersion: ctx.coefficientSetVersion,
    modelVersion: ctx.modelVersion,
  };
  return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

/** reference_id deterministico derivato dall'hash: VAL-XXXXXXXX. */
export function referenceIdFromHash(inputHash: string): string {
  return `VAL-${inputHash.slice(0, 8).toUpperCase()}`;
}
