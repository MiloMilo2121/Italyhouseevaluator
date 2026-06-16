/** Arrotondamenti deterministici per evitare il rumore floating-point nelle stime. */

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
