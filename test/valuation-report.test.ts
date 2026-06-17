import { describe, it, expect } from 'vitest';
import { renderValuationReport, type ValuationReportData } from '@/lib/report/valuation-report';
import type { ComparableContribution, EnrichResult } from '@/lib/valuation/types';

function enrichWith(comparables: ComparableContribution[]): EnrichResult {
  return {
    superficie_commerciale_mq: 85,
    zona_omi_id: 'MI_1',
    fallback_level: 'none',
    omi_eur_mq_min: 3500,
    omi_eur_mq_max: 4200,
    coefficients_applied: { merito_totale: 1.05 },
    estimate_min: 312375,
    estimate_max: 374850,
    confidence: { score: 88, label: 'Alta', fsd: 0.05 },
    breakdown: [{ label: 'Prezzo base zona', contributo: 327250 }],
    comparables,
  };
}

const data = (e: EnrichResult): ValuationReportData => ({
  referenceId: 'VAL-ABC',
  address: { normalized: 'Via Roma 1, Milano', raw: 'Via Roma 1', comune: 'Milano', lat: 45.46, lng: 9.19 },
  enrich: e,
});

describe('report di valutazione spiegabile (V2)', () => {
  it('contiene range, confidenza, breakdown e griglia di omogeneizzazione ATTRIBUITA', () => {
    const e = enrichWith([
      {
        id: 'immobiliare:1',
        source: 'annuncio',
        distanceMeters: 250,
        saleDate: '2025-11-01',
        stato: 'Normale',
        rawEurMq: 3000,
        discountedEurMq: 2850,
        correctedEurMq: 2990,
        weight: 0.8,
      },
    ]);
    const { html } = renderValuationReport(data(e));
    expect(html).toContain('312.375');
    expect(html).toContain('Alta');
    expect(html).toContain('omogeneizzazione');
    expect(html).toContain('annunci pubblici'); // attribuzione fonte
    expect(html).toContain('VAL-ABC');
  });

  it('degrada senza comparabili e senza stima OMI', () => {
    const e = enrichWith([]);
    e.estimate_min = null;
    e.estimate_max = null;
    e.omi_eur_mq_min = null;
    e.omi_eur_mq_max = null;
    const { html } = renderValuationReport(data(e));
    expect(html).toContain('Comparabili non disponibili');
    expect(html).toContain('non disponibile');
  });

  it('interleava la prosa narrata (V2 Step 2) quando presente, coi numeri autorevoli', () => {
    const e = enrichWith([]);
    const { html } = renderValuationReport({
      ...data(e),
      narrative: {
        sintesi: 'Sintesi narrata della valutazione.',
        spiegazione_valore: 'Spiegazione del valore.',
        commento_comparabili: 'Commento sui comparabili.',
        contesto_mercato: 'Contesto di mercato locale.',
        nota_confidenza: 'Nota sulla confidenza.',
      },
    });
    expect(html).toContain('Sintesi narrata della valutazione.');
    expect(html).toContain('Spiegazione del valore.');
    expect(html).toContain('Contesto di mercato locale.');
    expect(html).toContain('assistenza AI'); // attribuzione trasparente
    expect(html).toContain('312.375'); // i numeri del motore restano autorevoli
  });

  it('senza narrative non mostra né prosa né nota AI', () => {
    const { html } = renderValuationReport(data(enrichWith([])));
    expect(html).not.toContain('assistenza AI');
  });
});
