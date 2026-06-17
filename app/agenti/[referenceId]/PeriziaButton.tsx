'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Genera (on-demand) la perizia long-context e ricarica. La perizia formale è
 * persistita lato server; qui mostriamo stato/errori + link alla pagina
 * pronta-stampa. I numeri restano quelli del motore (l'LLM scrive le sezioni).
 */
export default function PeriziaButton({
  referenceId,
  hasPerizia,
}: {
  referenceId: string;
  hasPerizia: boolean;
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
      const res = await fetch('/api/agenti/perizia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: referenceId }),
      });
      const json = (await res.json()) as { error?: string; note?: string; perizia?: unknown };
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
    <div style={{ margin: '8px 0 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{ padding: '10px 18px', border: 0, borderRadius: 6, background: '#5f3dc4', color: '#fff', cursor: 'pointer' }}
      >
        {loading ? 'Generazione…' : hasPerizia ? 'Rigenera perizia' : 'Genera perizia'}
      </button>
      <Link href={`/agenti/${referenceId}/perizia`} style={{ fontSize: 14 }}>
        Apri perizia →
      </Link>
      {msg && <span style={{ color: '#868e96', fontSize: 13 }}>{msg}</span>}
      {err && <span style={{ color: '#c92a2a', fontSize: 13 }}>{err}</span>}
    </div>
  );
}
