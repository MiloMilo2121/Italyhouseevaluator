import { classeEnergeticaFactor } from './coefficients';
import type { MeritCoefficients, MeritResult, PianoLabel, PianoTable, SubjectProperty } from './types';
import { round4 } from './util';

/**
 * Coefficiente di merito (§6.4): prodotto dei SOLI fattori che OMI non cattura
 * (piano/ascensore × classe energetica × luminosità × correttivo di stato).
 * Le pertinenze NON sono qui (stanno nella superficie); lo stato NON è qui
 * (seleziona la riga OMI) — lo `stateCorrective` entra solo quando si è dovuto
 * ripiegare su una riga di stato diverso. Attributi assenti ⇒ fattore 1.00.
 */

interface PianoResolution {
  factor: number;
  key: string;
}

/**
 * Decision table piano completa e deterministica (fix #1).
 * Posizione × ascensore × ultimo, ogni cella definita.
 * PRECEDENZA: "alto senza ascensore" domina "ultimo senza ascensore"
 * (attico-walk-up al 5° → 0.80, non 0.85). Con ascensore l'ultimo (1.05)
 * domina l'intermedio (1.00).
 */
export function resolvePianoFactor(
  piano: number | null,
  pianoLabel: PianoLabel | null,
  pianiEdificio: number | null,
  ascensore: boolean,
  t: PianoTable,
): PianoResolution {
  if (pianoLabel === 'interrato') return { factor: t.interrato, key: 'interrato' };
  if (pianoLabel === 'seminterrato') return { factor: t.seminterrato, key: 'seminterrato' };
  if (pianoLabel === 'terra' || pianoLabel === 'rialzato') {
    return { factor: t.terra_rialzato, key: 'terra_rialzato' };
  }

  if (piano === null) return { factor: t.default, key: 'default' };
  if (piano === 0) return { factor: t.terra_rialzato, key: 'terra_rialzato' };

  const isUltimo = pianiEdificio !== null && piano >= pianiEdificio;
  const isAlto = piano >= 3;

  if (ascensore) {
    if (isUltimo) return { factor: t.ultimo_con_asc, key: 'ultimo_con_asc' };
    if (isAlto) return { factor: t.alto_con_asc, key: 'alto_con_asc' };
    return { factor: t.basso_con_asc, key: 'basso_con_asc' };
  }

  // senza ascensore — la penalità "alto" domina "ultimo".
  if (isAlto) return { factor: t.alto_senza_asc, key: 'alto_senza_asc' };
  if (isUltimo) return { factor: t.ultimo_senza_asc, key: 'ultimo_senza_asc' };
  return { factor: t.basso_senza_asc, key: 'basso_senza_asc' };
}

export function computeMeritCoefficient(
  subject: SubjectProperty,
  merit: MeritCoefficients,
  stateCorrective: number,
): MeritResult {
  const piano = resolvePianoFactor(
    subject.piano,
    subject.pianoLabel,
    subject.pianiEdificio,
    subject.ascensore,
    merit.piano,
  );
  const classe = classeEnergeticaFactor(merit, subject.classeEnergetica);
  const luminosita = merit.luminosita_esposizione.default;

  const factors: Record<string, number> = {
    piano: piano.factor,
    classe_energetica: classe,
    luminosita_esposizione: luminosita,
    stato_corrective: stateCorrective,
  };

  const coefficient = round4(piano.factor * classe * luminosita * stateCorrective);

  return { coefficient, factors, pianoKey: piano.key };
}
