import { renderValuationReport, type ValuationReportData } from '@/lib/report/valuation-report';
import { renderPerizia, type PeriziaReportData } from '@/lib/perizia/render';
import type { EnrichResult } from '@/lib/valuation/types';
import type { ValuationNarrative } from '@/lib/narration/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';
import type { Perizia } from '@/lib/perizia/types';

/**
 * Fixtures di ANTEPRIMA (dati fittizi) + renderer di un documento HTML standalone.
 * Riusa le funzioni di render PURE dell'app: nessun DB/LLM/env. Usato sia dalla
 * pagina /mock sia dallo script di generazione del file HTML.
 */

const address = {
  normalized: 'Via Vittor Pisani 12, Milano',
  raw: 'Via Vittor Pisani 12',
  comune: 'Milano',
  lat: 45.4808,
  lng: 9.2018,
};

const enrich: EnrichResult = {
  superficie_commerciale_mq: 92,
  zona_omi_id: 'MI-C12',
  fallback_level: 'none',
  omi_eur_mq_min: 3500,
  omi_eur_mq_max: 4200,
  coefficients_applied: { piano: 1.0, classe_energetica: 1.015, luminosita_esposizione: 1.0, merito_totale: 1.015 },
  estimate_min: 330000,
  estimate_max: 372000,
  confidence: { score: 78, label: 'Alta', fsd: 0.06 },
  breakdown: [
    { label: 'Prezzo base zona (OMI Ottimo, 2024-2) × 92 m²', contributo: 354200 },
    { label: 'Piano/ascensore (alto_con_asc)', contributo: 0 },
    { label: 'Classe energetica C', contributo: 5313 },
    { label: 'Box auto (valore a corpo)', contributo: 26000 },
  ],
  comparables: [
    { id: 'immobiliare:1', source: 'annuncio', distanceMeters: 180, saleDate: '2025-04-12', stato: 'Ottimo', rawEurMq: 4100, discountedEurMq: 3895, correctedEurMq: 3990, weight: 0.34 },
    { id: 'idealista:2', source: 'annuncio', distanceMeters: 320, saleDate: '2025-02-28', stato: 'Normale', rawEurMq: 3700, discountedEurMq: 3515, correctedEurMq: 3820, weight: 0.28 },
    { id: 'immobiliare_insights:3', source: 'agency', distanceMeters: 410, saleDate: '2025-01-15', stato: 'Ottimo', rawEurMq: 3950, discountedEurMq: 3950, correctedEurMq: 4010, weight: 0.22 },
    { id: 'idealista:4', source: 'annuncio', distanceMeters: 600, saleDate: '2024-11-30', stato: 'Normale', rawEurMq: 3600, discountedEurMq: 3420, correctedEurMq: 3760, weight: 0.16 },
  ],
};

const narrative: ValuationNarrative = {
  sintesi:
    'Trilocale di 92 m² commerciali in zona semicentrale di Milano, in ottimo stato e con classe energetica C. Il valore di mercato stimato è compreso tra 330.000 € e 372.000 €.',
  spiegazione_valore:
    'La stima parte dalla quotazione OMI di zona per immobili in stato ottimo e applica i coefficienti di merito (piano alto con ascensore, classe energetica). Il box auto è valutato a corpo.',
  commento_comparabili:
    'I quattro comparabili — annunci pubblici e una transazione — confermano un €/mq omogeneizzato tra 3.760 e 4.010 €/m², coerente con la stima.',
  contesto_mercato:
    'La zona presenta una domanda stabile; i prezzi di offerta sono stati scontati per il margine medio di trattativa prima del confronto.',
  nota_confidenza:
    'Confidenza Alta: comparabili numerosi, recenti e poco dispersi, in zona OMI risolta senza fallback.',
};

const catasto: CatastoData = {
  categoria: 'A/2',
  classe: '3',
  consistenzaVani: 5,
  renditaEuro: 750.5,
  superficieCatastaleMq: 95,
  foglio: '12',
  particella: '340',
  subalterno: '7',
};

const documentFacts: DocumentFacts = {
  appliedOverrides: [
    {
      field: 'classeEnergetica',
      value: 'C',
      confidence: 'alta',
      sourceDocument: 'ape',
      justification: 'Classe C leggibile chiaramente sull’APE depositato (era stata dichiarata D).',
    },
  ],
  dubbi: [
    {
      campo: 'superficieMq',
      dichiarato: 90,
      rilevato: 95,
      nota: 'La planimetria riporta una superficie calpestabile ~95 m²: verificare la metratura dichiarata (90 m²).',
    },
  ],
  sintesi: 'APE e planimetria confermano l’immobile; applicata la classe energetica C, segnalato uno scarto di superficie.',
  generatedAt: '2026-06-17T09:30:00.000Z',
};

const perizia: Perizia = {
  generatedAt: '2026-06-17T09:35:00.000Z',
  model: 'claude-opus-4-8',
  sections: {
    premessa:
      'La presente perizia interna stima il più probabile valore di mercato dell’immobile sito in Via Vittor Pisani 12, Milano, sulla base dei dati raccolti e delle quotazioni di zona, ad uso istruttorio dell’agenzia.',
    identificazione_immobile:
      'Appartamento trilocale, superficie commerciale 92 m² (90 m² dichiarati), piano alto con ascensore, dotato di box auto, in zona OMI MI-C12.',
    descrizione:
      'Unità in ottimo stato manutentivo, esposizione luminosa; la planimetria evidenzia cucina, due camere, doppi servizi e un ampio soggiorno.',
    dati_catastali:
      'Categoria A/2, classe 3, consistenza 5 vani, rendita catastale € 750,50; foglio 12, particella 340, subalterno 7. Superficie catastale 95 m².',
    analisi_mercato:
      'La quotazione OMI di zona per lo stato ottimo è 3.500–4.200 €/m² (semestre 2024-2). La zona mostra domanda stabile e tempi di vendita contenuti.',
    analisi_comparabili:
      'Quattro comparabili (annunci pubblici e una transazione) restituiscono un €/mq omogeneizzato tra 3.760 e 4.010 €/m², corretto per lo scarto offerta→rogito e per le differenze di stato/piano.',
    considerazioni_documentali:
      'Dall’APE è confermata la classe energetica C (applicata in luogo della D dichiarata). La planimetria indica ~95 m² calpestabili: si segnala lo scarto rispetto ai 90 m² dichiarati.',
    metodo_valutativo:
      'Metodo del confronto di mercato (MCA) ancorato alle quotazioni OMI: prezzo base di zona × superficie commerciale × coefficienti di merito, riconciliato con i comparabili e con un range coerente alla confidenza.',
    conclusione_valore:
      'Il più probabile valore di mercato è stimato tra 330.000 € e 372.000 €, con confidenza Alta.',
    limiti_assunzioni:
      'Stima orientativa basata su dati di offerta scontati e su documenti forniti; non sostituisce una perizia giurata né un sopralluogo tecnico. Salvo verifica della metratura effettiva.',
  },
};

export const mockReportData: ValuationReportData = {
  referenceId: 'VAL-7F3A2B9C',
  address,
  enrich,
  narrative,
  catasto,
  documentFacts,
};

export const mockPeriziaData: PeriziaReportData = {
  referenceId: 'VAL-7F3A2B9C',
  address,
  propertyType: 'appartamento',
  superficieDichiarataMq: 90,
  enrich,
  catasto,
  documentFacts,
  perizia,
};

const BANNER =
  '<div style="background:#fff3bf;border:1px solid #ffe066;border-radius:8px;padding:10px 14px;margin-bottom:16px">' +
  '<strong>Anteprima — dati fittizi.</strong> Schermate generate dalle stesse funzioni di render dell’app ' +
  '(report di valutazione e perizia), senza database né LLM.</div>';

/** Documento HTML standalone (per il file di anteprima da aprire nel browser). */
export function renderMockDocument(): string {
  const report = renderValuationReport(mockReportData).html;
  const peri = renderPerizia(mockPeriziaData).html;
  const card = (inner: string): string =>
    `<section style="background:#fff;border-radius:8px;padding:20px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,.06)">${inner}</section>`;
  return [
    '<!doctype html><html lang="it"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Anteprima — Valutatore Immobiliare Delfino</title></head>',
    '<body style="font-family:system-ui,Arial,sans-serif;background:#f8f9fa;margin:0;padding:24px 0">',
    '<div style="max-width:860px;margin:0 auto">',
    BANNER,
    card(report),
    card(peri),
    '</div></body></html>',
  ].join('');
}
