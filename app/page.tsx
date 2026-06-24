import Link from 'next/link';

/**
 * Landing pubblica (generica, no brand). Editoriale: hero serif + valore chiaro
 * + CTA al funnel. Server component, zero JS client.
 */
export default function HomePage() {
  return (
    <main>
      {/* Nav */}
      <header className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px' }}>
        <span className="serif" style={{ fontSize: 20 }}>Valutazione Immobiliare</span>
        <Link href="/valutazione" className="btn btn-primary" style={{ padding: '10px 18px' }}>
          Valuta gratis
        </Link>
      </header>

      {/* Hero */}
      <section className="wrap" style={{ padding: '56px 24px 28px', display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 48, alignItems: 'center' }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 16px' }}>Stima gratuita · risposta entro 24h</p>
          <h1 className="serif" style={{ fontSize: 'clamp(38px, 6vw, 62px)', lineHeight: 1.04, margin: '0 0 20px' }}>
            Scopri quanto vale<br />
            davvero il tuo <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>immobile</span>.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--muted)', maxWidth: 520, margin: '0 0 28px' }}>
            Una stima costruita sui dati ufficiali dell&apos;Agenzia delle Entrate e sul mercato reale della zona,
            con un range onesto e un livello di confidenza — non un numero a caso.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/valutazione" className="btn btn-primary">Inizia la valutazione →</Link>
            <span style={{ fontSize: 14, color: 'var(--faint)' }}>Gratis · senza impegno · 2 minuti</span>
          </div>
        </div>

        {/* Mini-anteprima valore */}
        <div className="card" style={{ padding: 28 }}>
          <p className="eyebrow" style={{ margin: '0 0 8px' }}>Esempio di stima</p>
          <div className="serif" style={{ fontSize: 38, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            € 330.000<span style={{ color: 'var(--faint)' }}> – </span>372.000
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 500, marginTop: 12 }}>
            Confidenza Alta · 78/100
          </div>
          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 18, paddingTop: 14, fontSize: 13.5, color: 'var(--muted)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base OMI di zona × m²</span><b style={{ color: 'var(--ink)' }}>€ 354.200</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Classe energetica, piano, box</span><b style={{ color: 'var(--ink)' }}>+ € 31.313</b></div>
          </div>
        </div>
      </section>

      {/* Come funziona */}
      <section className="wrap" style={{ padding: '40px 24px 16px' }}>
        <p className="eyebrow" style={{ margin: '0 0 22px' }}>Come funziona</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { n: '01', t: 'Descrivi l’immobile', d: 'Indirizzo, superficie, piano, condizioni: pochi passi guidati, due minuti.' },
            { n: '02', t: 'Calcoliamo il valore', d: 'Quotazioni OMI ufficiali + mercato reale della zona, con range e confidenza.' },
            { n: '03', t: 'Un esperto ti ricontatta', d: 'Ricevi la valutazione e il confronto con un nostro esperto entro 24 ore.' },
          ].map((s) => (
            <div key={s.n} className="card" style={{ padding: 24 }}>
              <div className="serif" style={{ fontSize: 30, color: 'var(--accent)' }}>{s.n}</div>
              <h3 className="serif" style={{ fontSize: 19, margin: '8px 0 6px' }}>{s.t}</h3>
              <p style={{ fontSize: 14.5, color: 'var(--muted)', margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="wrap" style={{ padding: '36px 24px 56px' }}>
        <div className="card" style={{ padding: '28px 32px', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16.5, color: 'var(--ink)', margin: 0, maxWidth: 640 }}>
            <span className="serif" style={{ fontStyle: 'italic' }}>Numeri onesti.</span>{' '}
            La stima poggia su dati ufficiali e sul mercato comparabile, con un margine dichiarato.
            Nessuna cifra gonfiata per acquisirti come cliente.
          </p>
          <Link href="/valutazione" className="btn btn-primary">Valuta il tuo immobile</Link>
        </div>
      </section>

      <footer className="wrap" style={{ padding: '20px 24px 40px', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--faint)' }}>
        Valutazione orientativa basata su dati pubblici (Agenzia delle Entrate – OMI) e mercato comparabile; non costituisce perizia giurata.
      </footer>
    </main>
  );
}
