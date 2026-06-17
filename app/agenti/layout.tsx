import type { ReactNode } from 'react';

// Protetta da auth (middleware) + RLS; mai prerenderizzata (niente env al build).
export const dynamic = 'force-dynamic';

export default function AgentiLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  );
}
