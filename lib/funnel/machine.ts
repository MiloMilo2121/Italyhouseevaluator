import { STEPS } from './steps';
import type { FunnelData, StepDef, StepId, ValidationResult } from './types';

/**
 * State machine del funnel (pura). Navigazione, validazione, completezza e
 * progress sopra `FunnelData`. La UI React la consuma senza contenere logica.
 */

export function visibleSteps(d: FunnelData): StepDef[] {
  return STEPS.filter((s) => s.isApplicable(d));
}

function stepDef(id: StepId): StepDef {
  const s = STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`Step sconosciuto: ${id}`);
  return s;
}

export function firstStep(d: FunnelData): StepId {
  return visibleSteps(d)[0]!.id;
}

export function nextStep(cur: StepId, d: FunnelData): StepId | null {
  const steps = visibleSteps(d);
  const i = steps.findIndex((s) => s.id === cur);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1]!.id : null;
}

export function prevStep(cur: StepId, d: FunnelData): StepId | null {
  const steps = visibleSteps(d);
  const i = steps.findIndex((s) => s.id === cur);
  return i > 0 ? steps[i - 1]!.id : null;
}

export function validateStep(cur: StepId, d: FunnelData): ValidationResult {
  return stepDef(cur).validate(d);
}

/** Uno step è "completo" se opzionale (saltabile) o se valido. */
export function isStepComplete(cur: StepId, d: FunnelData): boolean {
  const s = stepDef(cur);
  return s.optional || s.validate(d).ok;
}

/** Il funnel è completo quando tutti gli step richiesti applicabili sono validi. */
export function isComplete(d: FunnelData): boolean {
  return visibleSteps(d).every((s) => s.optional || s.validate(d).ok);
}

export function progress(cur: StepId, d: FunnelData): { index: number; total: number; ratio: number } {
  const steps = visibleSteps(d);
  const index = Math.max(0, steps.findIndex((s) => s.id === cur));
  const total = steps.length;
  return { index, total, ratio: total > 0 ? (index + 1) / total : 0 };
}
