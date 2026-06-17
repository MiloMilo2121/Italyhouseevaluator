import type { FunnelData } from '@/lib/funnel/types';

/** FunnelData completo e valido (worked example). */
export function makeFunnelData(overrides: Partial<FunnelData> = {}): FunnelData {
  return {
    address_raw: 'Via Roma 1, Milano',
    address_normalized: 'Via Roma 1, 20121 Milano MI',
    comune: 'Milano',
    cap: '20121',
    lat: 45.4642,
    lng: 9.19,
    property_type: 'appartamento',
    superficie_mq: 85,
    stanze: 3,
    ascensore: true,
    dotazioni: { balcone: false, garage: false, giardino: false },
    condizioni: 'ristrutturata',
    anni_ristrutturazione: '<5',
    piano: 3,
    piani_edificio: 6,
    intent: 'vendere_ora',
    nome: 'Mario',
    cognome: 'Rossi',
    email: 'mario.rossi@example.it',
    telefono: '3331234567',
    consent_privacy: true,
    consent_marketing: false,
    ...overrides,
  };
}
