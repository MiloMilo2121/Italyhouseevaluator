import { describe, it, expect } from 'vitest';
import { renderPerizia, type PeriziaReportData } from '@/lib/perizia/render';
import type { EnrichResult } from '@/lib/valuation/types';
import type { Perizia, PeriziaSections } from '@/lib/perizia/types';
import { makeCatasto } from './fixtures/documents.fixture';

function makeEnrich(): EnrichResult {
  return {
    superficie_commerciale_mq: 90,
    zona_omi_id: 'A',
    fallback_level: 'none',
    omi_eur_mq_min: 3500,
    omi_eur_mq_max: 4200,
    coefficients_applied: { merito_totale: 1.015 },
    estimate_min: 300000,
    estimate_max: 360000,
    confidence: { score: 80, label: 'Alta', fsd: 0.05 },
    breakdown: [{ label: 'Prezzo base zona (OMI Ottimo)', contributo: 330000 }],
    comparables: [],
  };
}

const sections: PeriziaSections = {
  premessa: 'Premessa di prova.',
  identificazione_immobile: 'Identificazione di prova.',
  descrizione: 'Descrizione di prova.',
  dati_catastali: 'Catasto di prova.',
  analisi_mercato: 'Mercato di prova.',
  analisi_comparabili: 'Comparabili di prova.',
  considerazioni_documentali: 'Documenti di prova.',
  metodo_valutativo: 'Metodo di prova.',
  conclusione_valore: 'Conclusione di prova.',
  limiti_assunzioni: 'Limiti di prova.',
};

function data(perizia: Perizia | null): PeriziaReportData {
  return {
    referenceId: 'VAL-TEST0001',
    address: { normalized: 'Via Test 1', raw: 'Via Test 1', comune: 'Milano', lat: 45.4, lng: 9.1 },
    propertyType: 'appartamento',
    superficieDichiarataMq: 85,
    enrich: makeEnrich(),
    catasto: makeCatasto(),
    documentFacts: null,
    perizia,
  };
}

describe('renderPerizia', () => {
  it('con perizia: sezioni di prosa + numeri autorevoli + tabelle', () => {
    const { html } = renderPerizia(data({ sections, generatedAt: '2026-06-17T00:00:00.000Z', model: 'claude-opus-4-8' }));
    expect(html).toContain('Perizia di valutazione VAL-TEST0001');
    expect(html).toContain('Premessa di prova.');
    expect(html).toContain('Metodo valutativo');
    expect(html).toContain('Prezzo base zona (OMI Ottimo)'); // breakdown autorevole
    expect(html).toContain('A/2'); // dati catastali
    expect(html).toMatch(/300\.000/); // range stima dal motore
  });

  it('senza perizia: banner "non ancora generata" + numeri presenti', () => {
    const { html } = renderPerizia(data(null));
    expect(html).toContain('non ancora generata');
    expect(html).toMatch(/300\.000/);
  });
});
