import { describe, it, expect } from 'vitest';
import { renderAgentCard, renderLeadConfirmation, type AgentCardData } from '@/lib/email/templates';
import type { EnrichResult } from '@/lib/valuation/types';

const enrichSample: EnrichResult = {
  superficie_commerciale_mq: 85,
  zona_omi_id: 'MI_1',
  fallback_level: 'none',
  omi_eur_mq_min: 3500,
  omi_eur_mq_max: 4200,
  coefficients_applied: { piano: 1, classe_energetica: 1.05, merito_totale: 1.05 },
  estimate_min: 312375,
  estimate_max: 374850,
  confidence: { score: 100, label: 'Alta', fsd: 0.05 },
  breakdown: [
    { label: 'Prezzo base zona (OMI Ottimo, 2024-2) × 85 m²', contributo: 327250 },
    { label: 'Classe energetica A', contributo: 16362.5 },
  ],
  comparables: [],
};

function cardData(enrich: EnrichResult | null): AgentCardData {
  return {
    referenceId: 'VAL-ABCD1234',
    lead: { nome: 'Mario', cognome: 'Rossi', email: 'm@e.it', telefono: '333', intent: 'vendere_ora', isPriority: true },
    property: {
      propertyType: 'appartamento',
      superficieMq: 85,
      stanze: 3,
      piano: 3,
      pianiEdificio: 6,
      ascensore: true,
      condizioni: 'ristrutturata',
      classeEnergetica: 'A',
      hasBalcone: false,
      hasGarage: false,
      hasGiardino: false,
    },
    address: { raw: 'Via Roma 1', normalized: 'Via Roma 1, Milano', comune: 'Milano', cap: '20100', lat: 45.467, lng: 9.19 },
    enrich,
    dashboardUrl: 'https://app.example/agenti/VAL-ABCD1234',
  };
}

describe('scheda agente (§10)', () => {
  it('contiene range €, confidence, badge priorità, breakdown, nota comps', () => {
    const c = renderAgentCard(cardData(enrichSample));
    expect(c.subject).toContain('VAL-ABCD1234');
    expect(c.html).toContain('312.375');
    expect(c.html).toContain('374.850');
    expect(c.html).toContain('Alta');
    expect(c.html).toContain('PRIORITÀ'); // intent vendere_ora ⇒ hot
    expect(c.html).toContain('Classe energetica');
    expect(c.html).toContain('Comparabili non disponibili');
  });

  it('degrada se enrichment non disponibile (EnrichResult null)', () => {
    const c = renderAgentCard(cardData(null));
    expect(c.html).toContain('Enrichment non riuscito');
    expect(c.html).toContain('Rossi'); // i dati del lead restano
  });
});

describe('conferma lead (§10)', () => {
  it('onesta e in-brand: messaggio 24h + riferimento', () => {
    const c = renderLeadConfirmation({ referenceId: 'VAL-XYZ', nome: 'Mario' });
    expect(c.subject).toContain('ricevuto');
    expect(c.html).toContain('24h');
    expect(c.html).toContain('Mario');
    expect(c.html).toContain('VAL-XYZ');
  });
});
