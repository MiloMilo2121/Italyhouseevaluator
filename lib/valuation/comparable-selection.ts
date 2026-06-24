import { condizioniToStato } from './omi';
import type { Comparable, SubjectProperty } from './types';

/**
 * Selezione comparabili (Fase 2), PURA. Due raggi (largo per il campione/edonica,
 * vicino per l'MCA) e uno score di SIMILARITÀ multi-attributo (oltre alla sola
 * superficie già pesata in weightComparables): stesso n. locali, terrazzo,
 * balcone, stato, superficie. Usato sia per pesare la stima edonica sia per
 * elencare i "comparabili più simili" nel report.
 */

const SURFACE_SIGMA_MQ = 30;

/** True se il subject dichiara un terrazzo (area esplicita > 0). */
export function subjectHasTerrazzo(s: SubjectProperty): boolean {
  return s.terrazzoAreaMq != null && s.terrazzoAreaMq > 0;
}

/** Score di similarità subject↔comp in [0,1]. Attributi assenti ⇒ contributo neutro. */
export function similarity(subject: SubjectProperty, comp: Comparable): number {
  const parts: { w: number; s: number }[] = [];

  // Superficie (gaussiana sulla differenza).
  const dSur = subject.superficieMq - comp.superficieCommercialeMq;
  parts.push({ w: 3, s: Math.exp(-(dSur * dSur) / (2 * SURFACE_SIGMA_MQ * SURFACE_SIGMA_MQ)) });

  // Numero di locali/camere.
  if (subject.stanze != null && comp.locali != null) {
    parts.push({ w: 3, s: Math.max(0, 1 - Math.abs(subject.stanze - comp.locali) / 3) });
  } else {
    parts.push({ w: 1, s: 0.5 });
  }

  // Terrazzo.
  if (comp.hasTerrazzo != null) {
    parts.push({ w: 1, s: subjectHasTerrazzo(subject) === comp.hasTerrazzo ? 1 : 0 });
  } else {
    parts.push({ w: 0.5, s: 0.5 });
  }

  // Balcone.
  if (comp.hasBalcone != null) {
    parts.push({ w: 1, s: subject.hasBalcone === comp.hasBalcone ? 1 : 0 });
  } else {
    parts.push({ w: 0.5, s: 0.5 });
  }

  // Stato di conservazione.
  const subjStato = condizioniToStato(subject.condizioni, subject.anniRistrutturazione);
  parts.push({ w: 1, s: subjStato === comp.stato ? 1 : 0.4 });

  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return wsum > 0 ? parts.reduce((a, p) => a + p.w * p.s, 0) / wsum : 0;
}

export interface RadiusSplit<T extends Comparable> {
  /** I `nearestN` comparabili più vicini (per l'MCA). */
  nearest: T[];
  /** Tutti i comparabili del raggio largo, ordinati per distanza (per l'edonica). */
  wide: T[];
}

/** Ordina per distanza e separa i `nearestN` più vicini (prefix) dal campione largo. */
export function splitByRadius<T extends Comparable>(comps: T[], nearestN: number): RadiusSplit<T> {
  const wide = [...comps].sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { nearest: wide.slice(0, Math.max(0, nearestN)), wide };
}

/** Top-k comparabili per similarità (per la sezione "più simili" del report). */
export function selectMostSimilar<T extends Comparable>(
  subject: SubjectProperty,
  comps: T[],
  k: number,
): T[] {
  return [...comps]
    .map((c) => ({ c, s: similarity(subject, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, k))
    .map((x) => x.c);
}
