'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Genera (on-demand) la relazione narrata e ricarica il dettaglio. La prosa è
 * persistita lato server; qui mostriamo solo stato/errori. Niente cifre nuove:
 * il report renderizza i numeri del motore e interleava la narrazione.
 */
export default function NarrateButton({
  referenceId,
  hasNarrative,
}: {
  referenceId: string;
  hasNarrative: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/agenti/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: referenceId }),
      });
      const json = (await res.json()) as { error?: string; note?: string; narrative?: unknown };
      if (!res.ok) throw new Error(json.error ?? 'Errore');
      if (json.note) setMsg(json.note);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: '8px 0 16px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          padding: '10px 18px',
          border: 0,
          borderRadius: 6,
          background: '#1c7ed6',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Generazione…' : hasNarrative ? 'Rigenera relazione narrata' : 'Genera relazione narrata'}
      </button>
      {msg && <p style={{ color: '#868e96', fontSize: 13 }}>{msg}</p>}
      {err && <p style={{ color: '#c92a2a', fontSize: 13 }}>{err}</p>}
    </div>
  );
}
