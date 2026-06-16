import type { ComparablesProvider } from './ports';
import type { Comparable, Estimate, SubjectProperty, WeightedComparable } from './types';

/**
 * SCAFFOLD per la Fase 2 (§6.5/6.6). In Fase 1 non c'è alcun comparabile: il
 * provider ritorna [] e l'intera catena collassa sul prior OMI (α = 0). Le firme
 * sono definite ORA così la Fase 2 si innesta senza refactor.
 */

const BANDWIDTH_M = 400; // h del kernel gaussiano spaziale
const TIME_LAMBDA = 0.05; // decadimento mensile
const GAMMA_SURFACE = 0.0005; // peso similarità sulla superficie
const ZONE_OUT_FACTOR = 0.3; // peso ridotto fuori zona OMI

export async function selectComparables(
  subject: SubjectProperty,
  provider: ComparablesProvider,
  opts?: { radiusMeters?: number; limit?: number },
): Promise<Comparable[]> {
  return provider.find(subject, opts);
}

function monthsBetween(saleDateIso: string, now: Date): number {
  const sale = new Date(saleDateIso).getTime();
  const diffMs = now.getTime() - sale;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Peso composito w = f_dist × f_sim × f_time × I_zonaOMI (§6.6). Implementato ma
 * inattivo in Fase 1 (nessun comparabile). `now` iniettabile per determinismo.
 */
export function weightComparables(
  subject: SubjectProperty,
  comps: Comparable[],
  now: Date = new Date(),
): WeightedComparable[] {
  return comps.map((c) => {
    const fDist = Math.exp(-(c.distanceMeters ** 2) / (2 * BANDWIDTH_M ** 2));
    const surfaceDiff = subject.superficieMq - c.superficieCommercialeMq;
    const fSim = Math.exp(-GAMMA_SURFACE * surfaceDiff ** 2);
    const fTime = Math.exp(-TIME_LAMBDA * monthsBetween(c.saleDate, now));
    const iZona = c.sameOmiZone ? 1 : ZONE_OUT_FACTOR;
    return { ...c, weight: fDist * fSim * fTime * iZona };
  });
}

/** α = n / (n + k). n = 0 ⇒ α = 0 (ci si fida del prior OMI). */
export function shrinkageAlpha(nComp: number, k: number): number {
  if (nComp + k === 0) return 0;
  return nComp / (nComp + k);
}

/** Shrinkage scalare: valore = α·MCA + (1−α)·prior. */
export function applyShrinkage(
  mcaEstimate: number | null,
  priorOmi: number,
  alpha: number,
): number {
  if (mcaEstimate == null) return priorOmi;
  return alpha * mcaEstimate + (1 - alpha) * priorOmi;
}

/**
 * Riconciliazione MCA ↔ prior OMI. In Fase 1 (weighted vuoto) ritorna il prior
 * OMI. Il ramo MCA (media pesata dei prezzi corretti + shrinkage) è Fase 2.
 */
export function reconcile(weighted: WeightedComparable[], priorOmi: Estimate): Estimate {
  if (weighted.length === 0) return priorOmi;
  // Fase 2: stima MCA dai comparabili pesati + applyShrinkage sul prior. Stub.
  return priorOmi;
}
