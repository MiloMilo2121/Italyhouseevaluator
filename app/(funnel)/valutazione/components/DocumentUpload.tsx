'use client';

import { useRef, useState } from 'react';

/**
 * Upload facoltativo nel funnel (post-submit): il venditore può allegare
 * planimetria e APE alla propria richiesta (per `reference_id`). NON mostra mai
 * un valore — rispetta il vincolo del funnel. Le note vocali sono solo lato
 * agente (dashboard), non qui.
 */

const KINDS: { kind: string; label: string }[] = [
  { kind: 'planimetria', label: 'Planimetria' },
  { kind: 'ape', label: 'Attestato di Prestazione Energetica (APE)' },
];

export default function DocumentUpload({ referenceId }: { referenceId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: string, file: File) {
    setBusy(kind);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('reference_id', referenceId);
      fd.append('kind', kind);
      fd.append('uploaded_by', 'seller');
      fd.append('file', file);
      const res = await fetch('/api/documenti/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Caricamento fallito');
      setDone((d) => [...d, kind]);
      const el = inputs.current[kind];
      if (el) el.value = '';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 24, textAlign: 'left', border: '1px solid #e9ecef', borderRadius: 8, padding: 16 }}>
      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Hai la planimetria o l’APE? (facoltativo)</p>
      <p style={{ margin: '0 0 12px', color: '#888', fontSize: 13 }}>
        Allegarli aiuta il nostro consulente a preparare una valutazione più precisa.
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
              accept="image/*,application/pdf"
              disabled={busy != null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(k.kind, f);
              }}
            />
            {done.includes(k.kind) && <span style={{ color: '#2b8a3e', marginLeft: 8 }}>caricato ✓</span>}
          </label>
        ))}
      </div>
      {err && <p style={{ color: '#c92a2a', fontSize: 13 }}>{err}</p>}
    </div>
  );
}
