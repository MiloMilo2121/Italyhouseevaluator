import { renderValuationReport } from '@/lib/report/valuation-report';
import { renderPerizia } from '@/lib/perizia/render';
import { mockPeriziaData, mockReportData } from '@/lib/mock/preview';

/**
 * Pagina di ANTEPRIMA (demo): renderizza le schermate-prodotto (report di
 * valutazione + perizia) con DATI FITTIZI, usando le stesse funzioni di render
 * pure dell'app. Nessun DB/LLM/env: serve a mostrare l'output dell'agente.
 */
export const dynamic = 'force-static';

export default function MockPage() {
  const report = renderValuationReport(mockReportData).html;
  const peri = renderPerizia(mockPeriziaData).html;
  return (
    <main style={{ fontFamily: 'system-ui,Arial,sans-serif', background: '#f8f9fa', padding: '24px 0' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ background: '#fff3bf', border: '1px solid #ffe066', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <strong>Anteprima — dati fittizi.</strong> Schermate generate dalle stesse funzioni di render dell’app
          (report di valutazione e perizia), senza database né LLM.
        </div>
        <section style={{ background: '#fff', borderRadius: 8, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div dangerouslySetInnerHTML={{ __html: report }} />
        </section>
        <section style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div dangerouslySetInnerHTML={{ __html: peri }} />
        </section>
      </div>
    </main>
  );
}
