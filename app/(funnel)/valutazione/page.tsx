import type { Metadata } from 'next';
import FunnelContainer from './FunnelContainer';

export const metadata: Metadata = {
  title: 'Valutazione gratuita — Delfino Real Estate',
  description: 'Scopri quanto vale il tuo immobile. Valutazione gratuita di un esperto entro 24h.',
};

/**
 * Funnel funzionante (M5). Componente self-contained, styling minimale: la UI di
 * produzione in-brand arriva da Claude Design e consuma lo stesso contratto §9.
 */
export default function ValutazionePage() {
  return <FunnelContainer />;
}
