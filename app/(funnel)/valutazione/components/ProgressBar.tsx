export default function ProgressBar({ index, total, ratio }: { index: number; total: number; ratio: number }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 7, letterSpacing: '.02em' }}>
        Passo {index + 1} di {total}
      </div>
      <div style={{ height: 5, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.round(ratio * 100)}%`,
            background: 'var(--accent)',
            transition: 'width .25s ease',
          }}
        />
      </div>
    </div>
  );
}
