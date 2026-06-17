'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeocodingSuggestion, ResolvedPlace } from '@/lib/geocoding/types';

/** Input con autocomplete via proxy /api/geocoding; cattura lat/lng client-side. */
export default function AddressAutocomplete({
  initial,
  onResolved,
}: {
  initial?: string;
  onResolved: (place: ResolvedPlace) => void;
}) {
  const [q, setQ] = useState(initial ?? '');
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const token = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocoding?q=${encodeURIComponent(q)}&token=${token.current}`);
        const data = (await res.json()) as { suggestions?: GeocodingSuggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function pick(s: GeocodingSuggestion) {
    try {
      const res = await fetch(`/api/geocoding?placeId=${encodeURIComponent(s.id)}&token=${token.current}`);
      const data = (await res.json()) as { place?: ResolvedPlace };
      if (data.place) {
        onResolved(data.place);
        setQ(data.place.address_normalized);
        setSuggestions([]);
        token.current = crypto.randomUUID();
      }
    } catch {
      /* best-effort */
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Via, civico, città"
        style={{ width: '100%', padding: '12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 6 }}
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '4px 0 0',
            padding: 0,
            border: '1px solid #eee',
            borderRadius: 6,
            position: 'absolute',
            background: '#fff',
            width: '100%',
            zIndex: 10,
          }}
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'none', cursor: 'pointer' }}
              >
                {s.label}
                {s.secondary ? <span style={{ color: '#888' }}> — {s.secondary}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
