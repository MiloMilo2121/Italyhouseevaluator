export default function ProgressBar({ index, total, ratio }: { index: number; total: number; ratio: number }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
        Passo {index + 1} di {total}
      </div>
      <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.round(ratio * 100)}%`,
            background: '#1c7ed6',
            transition: 'width .2s',
          }}
        />
      </div>
    </div>
  );
}
