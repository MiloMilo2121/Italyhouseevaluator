import { describe, it, expect } from 'vitest';
import { enrich, type EnrichDeps } from '@/lib/valuation/enrich';
import { defaultCoefficientSet } from './fixtures/coefficient-set.fixture';
import { FakeOmiResolver } from './fixtures/fake-omi-resolver';
import { emptyComparablesProvider } from './fixtures/fake-comparables-provider';
import { ZONE_A, POINT_IN_A } from './fixtures/omi-zones.fixture';
import { makeSubject } from './fixtures/subjects.fixture';

const deps: EnrichDeps = {
  coefficientSet: defaultCoefficientSet,
  omiResolver: new FakeOmiResolver([ZONE_A]),
  comparablesProvider: emptyComparablesProvider,
};

describe('decomposizione anti-double-counting (§6.4)', () => {
  it('lo stato cambia il €/mq via SELEZIONE RIGA, non via coefficiente moltiplicativo', async () => {
    const nuova = await enrich(
      makeSubject({ condizioni: 'nuova', anniRistrutturazione: null, location: POINT_IN_A }),
      deps,
    );
    const vecchia = await enrich(
      makeSubject({ condizioni: 'da_ristrutturare', anniRistrutturazione: null, location: POINT_IN_A }),
      deps,
    );

    // Il prezzo OMI differisce perché si seleziona una riga diversa (Ottimo vs Scadente).
    expect(nuova.omi_eur_mq_min).toBe(3500);
    expect(vecchia.omi_eur_mq_min).toBe(2100);

    // Il coefficiente di merito è IDENTICO: lo stato non è un moltiplicatore.
    expect(nuova.coefficients_applied['merito_totale']).toBe(
      vecchia.coefficients_applied['merito_totale'],
    );
    // Le righe esistono entrambe ⇒ nessun correttivo di stato.
    expect(nuova.coefficients_applied['stato_corrective']).toBe(1);
    expect(vecchia.coefficients_applied['stato_corrective']).toBe(1);
  });

  it('le pertinenze entrano nella superficie, NON nei fattori di merito', async () => {
    const conBalcone = await enrich(makeSubject({ hasBalcone: true, location: POINT_IN_A }), deps);
    const senza = await enrich(makeSubject({ hasBalcone: false, location: POINT_IN_A }), deps);

    expect(Object.keys(conBalcone.coefficients_applied)).not.toContain('balcone');
    expect(conBalcone.superficie_commerciale_mq).toBeGreaterThan(senza.superficie_commerciale_mq);
    // Il merito è invariato rispetto alla presenza del balcone.
    expect(conBalcone.coefficients_applied['merito_totale']).toBe(
      senza.coefficients_applied['merito_totale'],
    );
  });
});
