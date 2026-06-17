'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const input: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 16,
  border: '1px solid #ccc',
  borderRadius: 6,
  marginBottom: 10,
};

export default function FinalizeForm({
  referenceId,
  initialValue,
  initialNotes,
  status,
}: {
  referenceId: string;
  initialValue: number | null;
  initialNotes: string;
  status: string;
}) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '');
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(status === 'completed');
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/agenti/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: referenceId,
          agent_final_value: Number(value),
          agent_notes: notes || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Errore');
      setDone(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <label style={{ fontSize: 14 }}>Valore finale (€)</label>
      <input style={input} type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} required />
      <label style={{ fontSize: 14 }}>Note (opzionale)</label>
      <textarea style={{ ...input, minHeight: 80 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <p style={{ color: '#c92a2a', fontSize: 14 }}>{err}</p>}
      {done && <p style={{ color: '#2b8a3e', fontSize: 14 }}>✓ Valutazione chiusa (completed).</p>}
      <button
        type="submit"
        disabled={saving}
        style={{ padding: '12px 20px', border: 0, borderRadius: 6, background: '#2b8a3e', color: '#fff', cursor: 'pointer' }}
      >
        {saving ? 'Salvataggio…' : done ? 'Aggiorna valore' : 'Salva valore finale'}
      </button>
    </form>
  );
}
