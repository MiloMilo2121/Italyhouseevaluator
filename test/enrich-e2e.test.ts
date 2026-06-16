import { describe, it, expect } from 'vitest';
import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import { ZONE_A, ZONE_B, POINT_IN_A, POINT_IN_B } from './fixtures/omi-zones.fixture';
import { makeSubject } from './fixtures/subjects.fixture';

/**
 * Worked example end-to-end (fix #3: asserisce valori € ESATTI calcolati a mano
 * dal seed, non solo min<max). Trilocale 85 mq, 3° con ascensore (non ultimo →
 * 1.00), classe A (1.05), ristrutturata <5 → riga Ottimo 3500/4200, no pertinenze.
 *   merito        = 1.00 × 1.05 = 1.05
 *   point         = 3850 × 85 × 1.05 = 343.612,50
 *   estimate_min  = 3500 × 85 × 1.05 = 312.375
 *   estimate_max  = 4200 × 85 × 1.05 = 374.850
 */
describe('enrich end-to-end (worked example, no DB)', () => {
  const deps: EnrichDeps = {
    coefficientSet: defaultCoefficientSet,
    omiResolver: new FakeOmiResolver([ZONE_A]),
    comparablesProvider: emptyComparablesProvider,
  };

  it('produce superficie, riga OMI per stato, merito, range € esatti, confidenza e breakdown', async () => {
    const subj = makeSubject({
      superficieMq: 85,
      stanze: 3,
      piano: 3,
      pianiEdificio: 6,
      ascensore: true,
      classeEnergetica: 'A',
      condizioni: 'ristrutturata',
      anniRistrutturazione: '<5',
      hasBalcone: false,
      hasGarage: false,
      hasGiardino: false,
      location: POINT_IN_A,
    });
    const r = await enrich(subj, deps);

    expect(r.superficie_commerciale_mq).toBe(85);
    expect(r.zona_omi_id).toBe('A');
    expect(r.fallback_level).toBe('none');

    // Riga OMI selezionata per stato Ottimo.
    expect(r.omi_eur_mq_min).toBe(3500);
    expect(r.omi_eur_mq_max).toBe(4200);

    // Coefficiente di merito.
    expect(r.coefficients_applied['piano']).toBe(1.0);
    expect(r.coefficients_applied['classe_energetica']).toBe(1.05);
    expect(r.coefficients_applied['stato_corrective']).toBe(1);
    expect(r.coefficients_applied['merito_totale']).toBe(1.05);

    // Range € ESATTI.
    expect(r.estimate_min).toBe(312375);
    expect(r.estimate_max).toBe(374850);

    // Confidenza coerente con dati pieni in zona.
    expect(r.confidence.score).toBe(100);
    expect(r.confidence.label).toBe('Alta');

    // Breakdown popolato con contributi € esatti.
    const baseLine = r.breakdown.find((l) => l.label.startsWith('Prezzo base zona'));
    expect(baseLine?.contributo).toBe(327250); // 3850 × 85
    const classeLine = r.breakdown.find((l) => l.label.startsWith('Classe energetica'));
    expect(classeLine?.contributo).toBe(16362.5); // 327250 × (1.05 − 1)
  });

  it('variante: stato OMI richiesto mancante ⇒ ripiego su Normale + correttivo', async () => {
    const depsB: EnrichDeps = { ...deps, omiResolver: new FakeOmiResolver([ZONE_B]) };
    // nuova → Ottimo richiesto, ma Zona B ha solo Normale.
    const subjB = makeSubject({
      condizioni: 'nuova',
      anniRistrutturazione: null,
      classeEnergetica: 'A',
      piano: 3,
      pianiEdificio: 6,
      ascensore: true,
      location: POINT_IN_B,
    });
    const rB = await enrich(subjB, depsB);

    expect(rB.omi_eur_mq_min).toBe(2200); // riga Normale di Zona B
    expect(rB.coefficients_applied['stato_corrective']).toBe(1.1); // correttivo per Ottimo richiesto
    expect(rB.estimate_min).not.toBeNull();
  });
});
