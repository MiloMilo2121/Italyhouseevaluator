import { classeEnergeticaFactor, statoCorrectiveFactor } from './coefficients';
import { resolvePianoFactor } from './coefficient';
import { condizioniToStato } from './omi';
import { similarity, subjectHasTerrazzo } from './comparable-selection';
import { round2 } from './util';
import type {
  Comparable,
  HedonicFit,
  MeritCoefficients,
  SubjectProperty,
  WeightedComparable,
} from './types';

/**
 * Stima EDONICA dei premi degli attributi dai comparabili (Fase 2), PURA.
 *
 * Regressione lineare pesata RIDGE su log(€/mq) con PRIOR verso i coefficienti
 * fissi del seed. Le feature piano/classe/stato sono "merit-encoded"
 * (x = log(fattore_fisso)) così che β=1 ⇒ i dati confermano il fisso; le feature
 * nuove (locali, terrazzo, elasticità superficie) hanno prior 0 ⇒ nessun premio
 * finché i dati non lo mostrano. λ = λ0·k/(k+nEff): pochi comp ⇒ λ grande ⇒
 * β≈prior ⇒ FALLBACK automatico ai coefficienti fissi. Implementazione pura
 * (eliminazione di Gauss, p=7, +λR ⇒ mai singolare); su errore numerico ripiega
 * al modello identità (= comportamento fisso attuale).
 */

const FEATURES = ['classe', 'piano', 'stato', 'locali', 'terrazzo', 'super'] as const;
type Feature = (typeof FEATURES)[number];

const PRIOR: Record<Feature, number> = {
  classe: 1,
  piano: 1,
  stato: 1,
  locali: 0,
  terrazzo: 0,
  super: 0,
};

const LAMBDA0 = 1.0; // forza base del ridge
const K_SHRINK = 8; // λ = LAMBDA0 · K/(K+nEff)
const MIN_NEFF = 5; // sotto questa numerosità efficace ⇒ usedFixedFallback

export interface HedonicModel {
  summary: HedonicFit;
  /** Fattore di omogeneizzazione del €/mq del comp verso il subject (rapporto). */
  adjustFactor(comp: Comparable): number;
}

interface Centers {
  meanLocali: number;
  meanLogSuper: number;
}

function logPianoComp(c: Comparable, m: MeritCoefficients): number {
  return Math.log(
    resolvePianoFactor(c.piano ?? null, c.pianoLabel ?? null, c.pianiEdificio ?? null, c.ascensore ?? false, m.piano).factor,
  );
}
function logPianoSubject(s: SubjectProperty, m: MeritCoefficients): number {
  return Math.log(resolvePianoFactor(s.piano, s.pianoLabel, s.pianiEdificio, s.ascensore, m.piano).factor);
}

function featuresOfComp(c: Comparable, m: MeritCoefficients, ctr: Centers): Record<Feature, number> {
  return {
    classe: Math.log(classeEnergeticaFactor(m, c.classeEnergetica ?? null)),
    piano: logPianoComp(c, m),
    stato: Math.log(statoCorrectiveFactor(m, c.stato)),
    locali: (c.locali ?? ctr.meanLocali) - ctr.meanLocali,
    terrazzo: c.hasTerrazzo ? 1 : 0,
    super: Math.log(c.superficieCommercialeMq) - ctr.meanLogSuper,
  };
}
function featuresOfSubject(s: SubjectProperty, m: MeritCoefficients, ctr: Centers): Record<Feature, number> {
  return {
    classe: Math.log(classeEnergeticaFactor(m, s.classeEnergetica)),
    piano: logPianoSubject(s, m),
    stato: Math.log(statoCorrectiveFactor(m, condizioniToStato(s.condizioni, s.anniRistrutturazione))),
    locali: (s.stanze ?? ctr.meanLocali) - ctr.meanLocali,
    terrazzo: subjectHasTerrazzo(s) ? 1 : 0,
    super: Math.log(s.superficieMq) - ctr.meanLogSuper,
  };
}

/** Risolve A x = b (A simmetrica PD, dimensione p) con eliminazione di Gauss + pivot. Null se singolare. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const p = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    if (Math.abs(M[pivot]![col]!) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot]!, M[col]!];
    const pv = M[col]![col]!;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / pv;
      for (let k = col; k <= p; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  const x = new Array<number>(p);
  for (let i = 0; i < p; i++) x[i] = M[i]![p]! / M[i]![i]!;
  return x.every((v) => Number.isFinite(v)) ? x : null;
}

function identityModel(nEff: number, lambda: number): HedonicModel {
  const betas: Record<string, number> = { ...PRIOR };
  return {
    summary: { betas, nEff: round2(nEff), r2Weighted: 0, lambda: round2(lambda), usedFixedFallback: true },
    // β=prior ⇒ rapporto = fattore di merito fisso (classe/piano/stato), 1 per i nuovi attributi.
    adjustFactor: () => 1, // sostituito sotto quando i centri sono noti
  };
}

/**
 * Stima il modello edonico dai comparabili pesati. `obsWeight` (default
 * weight×similarità) governa quanto ogni comp influenza la regressione.
 */
export function fitHedonic(
  subject: SubjectProperty,
  comps: WeightedComparable[],
  merit: MeritCoefficients,
  obsWeight: (c: WeightedComparable) => number = (c) => Math.max(c.weight, 1e-9) * similarity(subject, c),
): HedonicModel {
  const items = comps.filter((c) => c.pricePerMq > 0 && c.superficieCommercialeMq > 0);

  const localiVals = items.map((c) => c.locali).filter((x): x is number => x != null);
  const meanLocali = localiVals.length ? localiVals.reduce((a, b) => a + b, 0) / localiVals.length : (subject.stanze ?? 3);
  const meanLogSuper = items.length
    ? items.reduce((a, c) => a + Math.log(c.superficieCommercialeMq), 0) / items.length
    : Math.log(subject.superficieMq);
  const ctr: Centers = { meanLocali, meanLogSuper };

  const nEff = items.reduce((a, c) => a + obsWeight(c), 0);
  const lambda = (LAMBDA0 * K_SHRINK) / (K_SHRINK + nEff);

  const adjustFromBetas = (betas: Record<string, number>) => (comp: Comparable): number => {
    const xc = featuresOfComp(comp, merit, ctr);
    const xs = featuresOfSubject(subject, merit, ctr);
    let s = 0;
    for (const f of FEATURES) s += (betas[f] ?? PRIOR[f]) * (xs[f] - xc[f]);
    return Number.isFinite(s) ? Math.exp(s) : 1;
  };

  if (items.length === 0) {
    const m = identityModel(0, lambda);
    return { summary: m.summary, adjustFactor: adjustFromBetas(PRIOR) };
  }

  // Design matrix: colonne [intercept, ...FEATURES]; ridge λ solo sulle feature, verso il prior.
  const cols = p_cols();
  const p = cols.length;
  const XtWX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const XtWy = new Array<number>(p).fill(0);

  for (const c of items) {
    const f = featuresOfComp(c, merit, ctr);
    const x = [1, ...FEATURES.map((k) => f[k])];
    const y = Math.log(c.pricePerMq);
    const w = Math.max(obsWeight(c), 0);
    for (let a = 0; a < p; a++) {
      XtWy[a]! += w * x[a]! * y;
      for (let b = 0; b < p; b++) XtWX[a]![b]! += w * x[a]! * x[b]!;
    }
  }
  // Ridge verso il prior (R diag: 0 intercetta, 1 feature).
  for (let i = 1; i < p; i++) {
    XtWX[i]![i]! += lambda;
    XtWy[i]! += lambda * PRIOR[FEATURES[i - 1]!]!;
  }

  const beta = solveLinear(XtWX, XtWy);
  if (beta == null) {
    return { summary: identityModel(nEff, lambda).summary, adjustFactor: adjustFromBetas(PRIOR) };
  }

  const betas: Record<string, number> = {};
  FEATURES.forEach((k, i) => (betas[k] = round2(beta[i + 1]!)));

  // R² pesato.
  let sw = 0;
  let swy = 0;
  for (const c of items) {
    const w = Math.max(obsWeight(c), 0);
    sw += w;
    swy += w * Math.log(c.pricePerMq);
  }
  const ybar = sw > 0 ? swy / sw : 0;
  let ssRes = 0;
  let ssTot = 0;
  for (const c of items) {
    const f = featuresOfComp(c, merit, ctr);
    const x = [1, ...FEATURES.map((k) => f[k])];
    const yhat = x.reduce((acc, xi, i) => acc + xi! * beta[i]!, 0);
    const y = Math.log(c.pricePerMq);
    const w = Math.max(obsWeight(c), 0);
    ssRes += w * (y - yhat) ** 2;
    ssTot += w * (y - ybar) ** 2;
  }
  const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;

  const summary: HedonicFit = {
    betas,
    nEff: round2(nEff),
    r2Weighted: round2(r2),
    lambda: round2(lambda),
    usedFixedFallback: nEff < MIN_NEFF,
  };
  return { summary, adjustFactor: adjustFromBetas(betas) };
}

function p_cols(): string[] {
  return ['intercept', ...FEATURES];
}
