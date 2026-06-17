'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Pannello documenti (dashboard agente). Carica planimetria/APE/note vocali,
 * lancia l'analisi (estrazione → riconciliazione → eventuale re-enrich) e mostra
 * lo stato di ciascun documento. Mostra solo stato/errori; i fatti riconciliati
 * compaiono nel report (sezione "Documenti & Catasto") dopo router.refresh().
 */

export interface DocItem {
  id: string;
  kind: string;
  status: string;
  mime: string | null;
  transcript: string | null;
  error: string | null;
}

const KINDS: { kind: string; label: string; accept: string }[] = [
  { kind: 'planimetria', label: 'Planimetria', accept: 'image/*,application/pdf' },
  { kind: 'ape', label: 'APE', accept: 'image/*,application/pdf' },
  { kind: 'nota_vocale', label: 'Nota vocale', accept: 'audio/*' },
];

const STATUS_COLOR: Record<string, string> = {
  uploaded: '#868e96',
  processing: '#1c7ed6',
  extracted: '#2b8a3e',
  failed: '#c92a2a',
};

export default function DocumentsPanel({
  referenceId,
  documents,
  documentiStatus,
}: {
  referenceId: string;
  documents: DocItem[];
  documentiStatus: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const router = useRouter();

  async function upload(kind: string, file: File) {
    setBusy(`upload-${kind}`);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('reference_id', referenceId);
      fd.append('kind', kind);
      fd.append('uploaded_by', 'agent');
      fd.append('file', file);
      const res = await fetch('/api/documenti/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload fallito');
      const el = inputs.current[kind];
      if (el) el.value = '';
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(null);
    }
  }

  async function process(mode: 'extract' | 'reconcile' | 'revert') {
    const res = await fetch('/api/documenti/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_id: referenceId, mode }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? `Elaborazione (${mode}) fallita`);
    return json;
  }

  async function analyze() {
    setBusy('analyze');
    setErr(null);
    setMsg(null);
    try {
      await process('extract');
      await process('reconcile');
      setMsg('Analisi completata.');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(null);
    }
  }

  async function revert() {
    setBusy('revert');
    setErr(null);
    setMsg(null);
    try {
      await process('revert');
      setMsg('Stima ripristinata dai dati dichiarati.');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(null);
    }
  }

  async function preview(id: string) {
    try {
      const res = await fetch(`/api/documenti/signed-url?id=${encodeURIComponent(id)}`);
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Anteprima non disponibile');
      window.open(json.url, '_blank', 'noopener');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    }
  }

  const hasUploaded = documents.some((d) => d.status === 'uploaded');

  return (
    <section style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 16, margin: '16px 0' }}>
      <h3 style={{ marginTop: 0 }}>Documenti & Catasto</h3>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        Carica planimetria, APE e note vocali. L’analisi estrae i fatti, segnala i dubbi e ricalcola la stima
        quando una correzione è affidabile.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {KINDS.map((k) => (
          <label key={k.kind} style={{ fontSize: 14 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>{k.label}</span>
            <input
              ref={(el) => {
                inputs.current[k.kind] = el;
              }}
              type="file"
              accept={k.accept}
              disabled={busy != null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(k.kind, f);
              }}
            />
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={busy != null || documents.length === 0}
          style={{ padding: '10px 18px', border: 0, borderRadius: 6, background: '#1c7ed6', color: '#fff', cursor: 'pointer' }}
        >
          {busy === 'analyze' ? 'Analisi…' : hasUploaded ? 'Analizza documenti' : 'Ri-analizza'}
        </button>
        {documentiStatus === 'reconciled' && (
          <button
            type="button"
            onClick={() => void revert()}
            disabled={busy != null}
            style={{ padding: '10px 18px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
          >
            {busy === 'revert' ? 'Ripristino…' : 'Ripristina dichiarato'}
          </button>
        )}
      </div>

      {msg && <p style={{ color: '#2b8a3e', fontSize: 13 }}>{msg}</p>}
      {err && <p style={{ color: '#c92a2a', fontSize: 13 }}>{err}</p>}

      {documents.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
          {documents.map((d) => (
            <li key={d.id} style={{ borderTop: '1px solid #eee', padding: '8px 0', fontSize: 14 }}>
              <strong>{d.kind}</strong>{' '}
              <span style={{ color: STATUS_COLOR[d.status] ?? '#868e96' }}>· {d.status}</span>
              {' '}
              <button
                type="button"
                onClick={() => void preview(d.id)}
                style={{ marginLeft: 8, fontSize: 12, background: 'none', border: 0, color: '#1c7ed6', cursor: 'pointer', textDecoration: 'underline' }}
              >
                anteprima
              </button>
              {d.transcript && <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>“{d.transcript}”</p>}
              {d.error && <p style={{ color: '#c92a2a', fontSize: 12, margin: '4px 0 0' }}>{d.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
