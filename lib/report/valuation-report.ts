import type { EnrichResult } from '@/lib/valuation/types';

/**
 * Report di valutazione spiegabile (V2, "wow #1"), PURO/HTML pronto-stampa.
 * Range + confidenza onesta, breakdown voce-per-voce e GRIGLIA DI
 * OMOGENEIZZAZIONE dei comparabili (sintetici e ATTRIBUITI: niente foto/
 * descrizioni copiate). Riusabile in dashboard e (versione email) altrove.
 */

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurMq = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function fmtEur(n: number): string {
  return eur.format(n);
}
function fmtEurMq(n: number): string {
  return `${eurMq.format(n)}/m²`;
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ValuationReportData {
  referenceId: string;
  address: { normalized: string | null; raw: string; comune: string | null; lat: number; lng: number };
  enrich: EnrichResult;
}

function rangeBlock(e: EnrichResult): string {
  if (e.estimate_min == null || e.estimate_max == null) {
    return `<p style="padding:12px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px">
      Stima non disponibile su base OMI per questa zona (fallback: ${e.fallback_level}).</p>`;
  }
  return `<p style="font-size:20px"><strong>${fmtEur(e.estimate_min)} – ${fmtEur(e.estimate_max)}</strong>
    &nbsp;<span style="background:#e7f5ee;padding:2px 8px;border-radius:10px">Confidenza: ${e.confidence.label} (${e.confidence.score}/100)</span></p>`;
}

function breakdownTable(e: EnrichResult): string {
  const rows = e.breakdown
    .map(
      (b) =>
        `<tr><td style="padding:4px 8px;border-top:1px solid #eee">${esc(b.label)}</td>
         <td style="padding:4px 8px;border-top:1px solid #eee;text-align:right">${fmtEur(b.contributo)}</td></tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px"><tbody>${rows}</tbody></table>`;
}

function adjustmentGrid(e: EnrichResult): string {
  if (e.comparables.length === 0) {
    return `<p style="color:#666;font-size:13px">Comparabili non disponibili — stima su base OMI.</p>`;
  }
  const head = ['Rif.', 'Dist.', 'Data', 'Stato', '€/m² offerta', '€/m² scontato', '€/m² omogeneizz.', 'Peso']
    .map((h) => `<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #eee">${h}</th>`)
    .join('');
  const rows = e.comparables
    .map(
      (c, i) =>
        `<tr>
          <td style="padding:4px 8px">#${i + 1}</td>
          <td style="padding:4px 8px">${Math.round(c.distanceMeters)} m</td>
          <td style="padding:4px 8px">${esc(c.saleDate.slice(0, 10))}</td>
          <td style="padding:4px 8px">${c.stato}</td>
          <td style="padding:4px 8px;text-align:right">${fmtEurMq(c.rawEurMq)}</td>
          <td style="padding:4px 8px;text-align:right">${fmtEurMq(c.discountedEurMq)}</td>
          <td style="padding:4px 8px;text-align:right"><strong>${fmtEurMq(c.correctedEurMq)}</strong></td>
          <td style="padding:4px 8px;text-align:right">${c.weight.toFixed(2)}</td>
        </tr>`,
    )
    .join('');
  return `
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr>${head}</tr></thead><tbody>${rows}</tbody>
    </table>
    <p style="color:#777;font-size:12px;margin-top:8px">
      Fonte: annunci pubblici (Immobiliare.it / Idealista), aggregati internamente. Prezzi di
      offerta corretti per lo scarto offerta→rogito e omogeneizzati verso l'immobile in esame.</p>`;
}

export function renderValuationReport(data: ValuationReportData): { html: string } {
  const { enrich: e, address } = data;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
  const omi =
    e.omi_eur_mq_min != null && e.omi_eur_mq_max != null
      ? `${fmtEurMq(e.omi_eur_mq_min)} – ${fmtEurMq(e.omi_eur_mq_max)}`
      : 'n/d';

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px;margin:0 auto;color:#222">
    <h2>Valutazione ${esc(data.referenceId)}</h2>
    <p>${esc(address.normalized ?? address.raw)}${address.comune ? `, ${esc(address.comune)}` : ''}
       — <a href="${mapUrl}">mappa</a></p>

    <h3>Valore stimato</h3>
    ${rangeBlock(e)}
    <p style="color:#555;font-size:14px">Superficie commerciale: <strong>${e.superficie_commerciale_mq} m²</strong>
       · €/m² OMI di zona: ${omi} · zona ${esc(e.zona_omi_id ?? 'n/d')} · risoluzione: ${e.fallback_level}</p>

    <h3>Come si compone</h3>
    ${breakdownTable(e)}

    <h3>Comparabili (griglia di omogeneizzazione)</h3>
    ${adjustmentGrid(e)}

    <h3>Contesto di mercato</h3>
    <p style="font-size:14px;color:#555">Quotazione OMI di zona ${omi}. I prezzi degli annunci sono di offerta
       e vengono scontati per il margine medio di trattativa prima del confronto. La confidenza riflette
       numero, dispersione e freschezza dei comparabili.</p>
  </div>`;

  return { html };
}
