'use client';

import { useState } from 'react';

/**
 * Invia al cliente il report sintetico via email (route /api/agenti/report-cliente)
 * e offre il link all'anteprima stampabile (Salva come PDF dal browser). Niente
 * cifre nuove: il report cliente è la variante sintetica dei numeri del motore.
 */
export default function ClientReportButton({
  referenceId,
  clientEmail,
}: {
  referenceId: string;
  clientEmail: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSend() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/agenti/report-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: referenceId }),
      });
      const json = (await res.json()) as { error?: string; to?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore');
      setMsg(`Report inviato a ${json.to}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0 16px' }}>
      <button
        type="button"
        onClick={onSend}
        disabled={loading}
        style={{ padding: '10px 18px', border: 0, borderRadius: 6, background: '#1f5c52', color: '#fff', cursor: 'pointer' }}
      >
        {loading ? 'Invio…' : `Invia report al cliente (${clientEmail || 'no email'})`}
      </button>
      <a
        href={`/agenti/${referenceId}/cliente`}
        target="_blank"
        rel="noreferrer"
        style={{ color: '#1f5c52', fontSize: 14 }}
      >
        Anteprima cliente / Salva come PDF →
      </a>
      {msg && <span style={{ color: '#2f6f4f', fontSize: 13 }}>{msg}</span>}
      {err && <span style={{ color: '#c92a2a', fontSize: 13 }}>{err}</span>}
    </div>
  );
}
