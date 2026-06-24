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
      <div className="card" style={{ padding: '28px 26px', maxWidth: 400, textAlign: 'center' }}>
        <h3 className="serif" style={{ marginTop: 0, fontSize: 22 }}>Aspetta!</h3>
        <p style={{ color: 'var(--muted)' }}>Mancano pochi passi per ricevere la valutazione gratuita del tuo immobile.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShown(false);
            setDismissed(true);
          }}
        >
          Continua la valutazione
        </button>
      </div>
    </div>
  );
}
