import type { SubjectProperty } from '@/lib/valuation/types';
import { POINT_IN_A } from './omi-zones.fixture';

/**
 * Builder di SubjectProperty con default sensati (il worked example del brief:
 * trilocale 85 mq, 3° con ascensore, classe A, ristrutturata recente).
 */
export function makeSubject(overrides: Partial<SubjectProperty> = {}): SubjectProperty {
  return {
    propertyType: 'appartamento',
    superficieMq: 85,
    stanze: 3,
    ascensore: true,
    hasBalcone: false,
    hasGarage: false,
    hasGiardino: false,
    condizioni: 'ristrutturata',
    anniRistrutturazione: '<5',
    piano: 3,
    pianoLabel: null,
    pianiEdificio: 6,
    riscaldamento: 'autonomo',
    classeEnergetica: 'A',
    location: POINT_IN_A,
    comuneCode: 'F205',
    ...overrides,
  };
}
