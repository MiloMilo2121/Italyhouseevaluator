import { renderValuationReport } from '@/lib/report/valuation-report';
import { mockReportData } from '@/lib/mock/preview';

/**
 * Pagina di ANTEPRIMA (demo): renderizza i DUE report (agente completo + cliente
 * più corto) con DATI FITTIZI, usando la stessa funzione di render pura dell'app.
 * Nessun DB/LLM/env.
 */
export const dynamic = 'force-static';

const eyebrow = {
  fontSize: 12,
  letterSpacing: '.16em',
  textTransform: 'uppercase' as const,
  color: '#1f5c52',
  fontWeight: 600,
  margin: '0 0 8px',
};

export default function MockPage() {
  const agent = renderValuationReport(mockReportData, 'agent').html;
  const client = renderValuationReport(mockReportData, 'client').html;
  return (
    <main style={{ fontFamily: 'system-ui,Arial,sans-serif', background: '#eceae3', padding: '24px 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0dccf', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#5b574e' }}>
          <strong>Anteprima — dati fittizi.</strong> I due report sono generati dalla stessa funzione pura dell&apos;app, senza database né LLM.
        </div>
        <p style={eyebrow}>Report agente — completo</p>
        <div style={{ marginBottom: 36, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div dangerouslySetInnerHTML={{ __html: agent }} />
        </div>
        <p style={eyebrow}>Report cliente — sintetico</p>
        <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div dangerouslySetInnerHTML={{ __html: client }} />
        </div>
      </div>
    </main>
  );
}
