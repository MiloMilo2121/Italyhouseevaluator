/**
 * Placeholder landing. Il funnel funzionante arriva in M5; la UI di
 * produzione (in-brand Delfino) è generata separatamente in Claude Design
 * e consumerà lo stesso contratto API §9.
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Valutatore Immobiliare Delfino</h1>
      <p>
        Scopri quanto vale il tuo immobile. Valutazione gratuita di un nostro
        esperto entro 24h.
      </p>
      <p style={{ color: '#666', fontSize: 14 }}>
        Scaffold Fase 1 — il funnel sarà disponibile alla Milestone 5.
      </p>
    </main>
  );
}
