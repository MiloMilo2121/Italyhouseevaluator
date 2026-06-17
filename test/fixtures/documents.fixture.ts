import type {
  ApeExtraction,
  CatastoData,
  PlanimetriaExtraction,
  ReconciliationResult,
} from '@/lib/documents/types';
import type { ValuationRequestRow } from '@/lib/documents/row-to-subject';

/** Builder di fixture per i test del layer documenti (no rete/DB). */

export function makeApeExtraction(o: Partial<ApeExtraction> = {}): ApeExtraction {
  return { classeEnergetica: 'C', epglNrenKwhMqAnno: 120, leggibile: true, confidence: 'alta', ...o };
}

export function makePlanimetria(o: Partial<PlanimetriaExtraction> = {}): PlanimetriaExtraction {
  return {
    vani: 4,
    superficieCalpestabileMq: 92,
    locali: ['cucina', 'camera', 'bagno'],
    leggibile: true,
    confidence: 'media',
    ...o,
  };
}

export function makeCatasto(o: Partial<CatastoData> = {}): CatastoData {
  return {
    categoria: 'A/2',
    classe: '3',
    consistenzaVani: 5,
    renditaEuro: 750.5,
    superficieCatastaleMq: 95,
    foglio: '12',
    particella: '340',
    subalterno: '7',
    ...o,
  };
}

/** Payload Catasto "grezzo" (forma di un ipotetico provider), con numeri IT. */
export const CATASTO_RAW_FIXTURE = {
  categoria: 'A/2',
  classe: '3',
  consistenza: '5,5 vani',
  rendita: '750,50',
  superficie_catastale: '95',
  identificativo: { foglio: '12', particella: '340', subalterno: '7' },
};

export function makeReconciliation(o: Partial<ReconciliationResult> = {}): ReconciliationResult {
  return {
    overrides: [
      {
        field: 'classeEnergetica',
        value: 'C',
        confidence: 'alta',
        sourceDocument: 'ape',
        justification: 'Classe leggibile sull’APE ufficiale.',
      },
    ],
    dubbi: [],
    sintesi: 'L’APE conferma la classe C.',
    ...o,
  };
}

export function makeValuationRow(o: Partial<ValuationRequestRow> = {}): ValuationRequestRow {
  return {
    property_type: 'appartamento',
    superficie_mq: '85',
    stanze: '3',
    ascensore: true,
    has_balcone: false,
    has_garage: false,
    has_giardino: false,
    condizioni: 'ristrutturata',
    anni_ristrutturazione: '<5',
    piano: '3',
    piano_label: null,
    piani_edificio: '6',
    riscaldamento: 'autonomo',
    classe_energetica: 'D',
    lat: '44.1',
    lng: '12.2',
    ...o,
  };
}
