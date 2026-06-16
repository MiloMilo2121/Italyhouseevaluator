import { statoCorrectiveFactor } from './coefficients';
import type {
  AnniRistrutturazione,
  Condizioni,
  MeritCoefficients,
  OmiQuotationRow,
  OmiResolution,
  OmiRowSelection,
  OmiStato,
} from './types';
import { round2 } from './util';

/**
 * Mappatura stato + selezione riga OMI + stima base. Funzioni pure.
 * QUI vive l'anti-double-counting: lo stato di conservazione seleziona la RIGA
 * OMI (Ottimo/Normale/Scadente), non è mai un coefficiente moltiplicativo.
 */

/**
 * condizioni (+ anni ristrutturazione) → stato OMI.
 * nuova → Ottimo; ristrutturata → Ottimo SALVO `>10` anni → Normale (decadimento,
 * fix #2: non trattare una ristrutturazione vecchia come Ottimo);
 * parz_ristrutturata → Normale; da_ristrutturare → Scadente.
 */
export function condizioniToStato(
  condizioni: Condizioni,
  anni: AnniRistrutturazione | null,
): OmiStato {
  switch (condizioni) {
    case 'nuova':
      return 'Ottimo';
    case 'ristrutturata':
      return anni === '>10' ? 'Normale' : 'Ottimo';
    case 'parz_ristrutturata':
      return 'Normale';
    case 'da_ristrutturare':
      return 'Scadente';
  }
}

/**
 * Sceglie la riga OMI per lo stato richiesto. Se manca, ripiega su Normale e
 * applica un coefficiente correttivo dal set (stato_corrective[richiesto]).
 * Se Normale manca, usa la prima riga disponibile col correttivo. Se non ci sono
 * righe, row = null (nessun dato OMI usabile).
 */
export function selectOmiRow(
  resolution: OmiResolution,
  requestedStato: OmiStato,
  merit: MeritCoefficients,
): OmiRowSelection {
  const rows = resolution.rows;
  if (rows.length === 0) {
    return { row: null, requestedStato, usedStato: null, stateCorrectiveApplied: 1 };
  }

  const exact = rows.find((r) => r.stato === requestedStato);
  if (exact) {
    return { row: exact, requestedStato, usedStato: requestedStato, stateCorrectiveApplied: 1 };
  }

  const fallbackRow = rows.find((r) => r.stato === 'Normale') ?? rows[0]!;
  return {
    row: fallbackRow,
    requestedStato,
    usedStato: fallbackRow.stato,
    stateCorrectiveApplied: statoCorrectiveFactor(merit, requestedStato),
  };
}

export interface BaseEstimate {
  baseMin: number | null;
  baseMax: number | null;
}

/**
 * Stima base (Livello 0, §6.5): base = omi_eur_mq × superficie_commerciale ×
 * coeff_merito. Il coeff_merito include già lo stateCorrective. Null se no OMI.
 */
export function computeBaseEstimate(
  row: OmiQuotationRow | null,
  superficieCommercialeMq: number,
  coeffMerito: number,
): BaseEstimate {
  if (row == null) return { baseMin: null, baseMax: null };
  return {
    baseMin: round2(row.comprMin * superficieCommercialeMq * coeffMerito),
    baseMax: round2(row.comprMax * superficieCommercialeMq * coeffMerito),
  };
}
