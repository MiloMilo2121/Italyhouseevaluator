import type { SubjectProperty, SurfaceComponent, SurfaceResult, SurfaceWeights } from './types';
import { round2 } from './util';

/**
 * Superficie commerciale (§6.1): superficie_commerciale = Σ(area_i × coeff_i).
 * Funzioni pure. Il box auto NON è una % della superficie: è un valore a corpo
 * separato (boxAutoValue), scalato sul €/mq di zona.
 */

/** Formula pura della superficie ragguagliata: somma di area × coefficiente. */
export function weightedSurface(components: Pick<SurfaceComponent, 'areaMq' | 'coeff'>[]): number {
  return round2(components.reduce((sum, c) => sum + c.areaMq * c.coeff, 0));
}

/**
 * Costruisce i contributi di superficie dal subject. Le metrature esplicite
 * (balconeAreaMq, ...) hanno priorità; in loro assenza, per le dotazioni
 * booleane si usano le aree di default dal coefficient_set (calibrabili).
 * Attributi assenti ⇒ contributo 0. Box auto escluso (valore a corpo).
 */
export function computeSurface(subject: SubjectProperty, w: SurfaceWeights): SurfaceResult {
  const components: SurfaceComponent[] = [];

  const push = (label: string, areaMq: number, coeff: number): void => {
    components.push({ label, areaMq, coeff, commercialMq: round2(areaMq * coeff) });
  };

  // Superficie utile (sempre presente).
  push('Superficie utile', subject.superficieMq, w.superficie_utile);

  // Balcone / terrazzo.
  if (subject.balconeAreaMq != null) {
    const coperto = subject.balconeCoperto === true;
    push(
      coperto ? 'Balcone/terrazzo coperto' : 'Balcone/terrazzo scoperto',
      subject.balconeAreaMq,
      coperto ? w.balcone_coperto : w.balcone_scoperto,
    );
  } else if (subject.hasBalcone) {
    push(
      `Balcone (area stimata ${w.default_area_balcone_mq} m²)`,
      w.default_area_balcone_mq,
      w.balcone_scoperto,
    );
  }
  if (subject.terrazzoAreaMq != null) {
    push('Terrazzo scoperto', subject.terrazzoAreaMq, w.terrazzo_scoperto);
  }

  // Giardino.
  if (subject.giardinoAreaMq != null) {
    push('Giardino', subject.giardinoAreaMq, w.giardino_appartamento);
  } else if (subject.hasGiardino) {
    push(
      `Giardino (area stimata ${w.default_area_giardino_mq} m²)`,
      w.default_area_giardino_mq,
      w.giardino_appartamento,
    );
  }

  // Cantina / soffitta (solo se metratura esplicita: il contratto Fase 1 non le invia).
  if (subject.cantinaAreaMq != null) {
    push('Cantina non comunicante', subject.cantinaAreaMq, w.cantina_non_comunicante);
  }
  if (subject.soffittaAreaMq != null) {
    push('Soffitta non comunicante', subject.soffittaAreaMq, w.soffitta_non_comunicante);
  }

  return {
    superficieCommercialeMq: weightedSurface(components),
    contributions: components,
  };
}

/**
 * Valore a corpo del box auto/garage, scalato sul €/mq di zona (fix #8):
 * box = box_auto_mq_default × omiMidEurMq × box_auto_coeff. Senza OMI ⇒ 0.
 */
export function boxAutoValue(
  w: SurfaceWeights,
  omiMidEurMq: number | null,
  hasGarage: boolean,
): number {
  if (!hasGarage || omiMidEurMq == null) return 0;
  return round2(w.box_auto_mq_default * omiMidEurMq * w.box_auto_coeff);
}
