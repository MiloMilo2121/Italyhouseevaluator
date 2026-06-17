'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/db/supabase-browser';

const input: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 16,
  border: '1px solid #ccc',
  borderRadius: 6,
  marginBottom: 10,
};

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace('/agenti');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input style={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <p style={{ color: '#c92a2a', fontSize: 14 }}>{err}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{ width: '100%', padding: 12, border: 0, borderRadius: 6, background: '#1c7ed6', color: '#fff', cursor: 'pointer' }}
      >
        {loading ? 'Accesso…' : 'Entra'}
      </button>
    </form>
  );
}
