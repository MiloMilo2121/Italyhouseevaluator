'use client';

import { useEffect, useState } from 'react';

/** Modale exit-intent (mouseleave dall'alto). Stato solo in React, no storage. */
export default function ExitIntentModal() {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onLeave(e: MouseEvent) {
      if (e.clientY <= 0 && !dismissed) setShown(true);
    }
    document.addEventListener('mouseout', onLeave);
    return () => document.removeEventListener('mouseout', onLeave);
  }, [dismissed]);

  if (!shown || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 380, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>Aspetta!</h3>
        <p>Mancano pochi passi per ricevere la valutazione gratuita del tuo immobile.</p>
        <button
          onClick={() => {
            setShown(false);
            setDismissed(true);
          }}
          style={{ background: '#1c7ed6', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 6, cursor: 'pointer' }}
        >
          Continua la valutazione
        </button>
      </div>
    </div>
  );
}
