import type { EnrichResult } from '@/lib/valuation/types';
import type { ValuationNarrative } from '@/lib/narration/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';

/**
 * Report di valutazione spiegabile (V2, "wow #1"), PURO/HTML pronto-stampa.
 * Range + confidenza onesta, breakdown voce-per-voce e GRIGLIA DI
 * OMOGENEIZZAZIONE dei comparabili (sintetici e ATTRIBUITI: niente foto/
 * descrizioni copiate). Riusabile in dashboard e (versione email) altrove.
 *
 * V2 Step 2: se è presente una `narrative` (prosa LLM grounded), le sezioni di
 * testo vengono interleavate coi numeri AUTOREVOLI calcolati dal motore — l'LLM
 * spiega, non ricalcola. Senza narrative il report resta sui soli numeri.
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
  /** Prosa LLM grounded (V2 Step 2). Assente/null ⇒ report sui soli numeri. */
  narrative?: ValuationNarrative | null;
  /** Fatti documentali (V2 Step 3): lookup catastale + riconciliazione. */
  catasto?: CatastoData | null;
  documentFacts?: DocumentFacts | null;
}

/** Paragrafo di prosa narrata (escaped). Reso solo se il testo è presente. */
function prose(text: string | undefined): string {
  if (!text) return '';
  return `<p style="font-size:14px;line-height:1.5;color:#333;margin:6px 0">${esc(text)}</p>`;
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

function show(v: unknown): string {
  return v == null || v === '' ? 'n/d' : String(v);
}

/** Sezione "Documenti & Catasto" (V2 Step 3). Resa solo se ci sono fatti documentali. */
function documentiSection(
  catasto: CatastoData | null | undefined,
  facts: DocumentFacts | null | undefined,
): string {
  if (catasto == null && facts == null) return '';
  const parts: string[] = ['<h3>Documenti &amp; Catasto</h3>'];

  if (catasto) {
    const rows: string[] = [];
    const add = (label: string, v: string | number | null): void => {
      if (v != null && v !== '') {
        rows.push(
          `<tr><td style="padding:4px 8px;border-top:1px solid #eee">${esc(label)}</td>
           <td style="padding:4px 8px;border-top:1px solid #eee;text-align:right">${esc(String(v))}</td></tr>`,
        );
      }
    };
    add('Categoria catastale', catasto.categoria);
    add('Classe', catasto.classe);
    add('Consistenza (vani)', catasto.consistenzaVani);
    add('Rendita', catasto.renditaEuro != null ? fmtEur(catasto.renditaEuro) : null);
    add('Superficie catastale', catasto.superficieCatastaleMq != null ? `${catasto.superficieCatastaleMq} m²` : null);
    const ident = [catasto.foglio, catasto.particella, catasto.subalterno].filter(Boolean).join(' / ');
    add('Foglio / Particella / Sub', ident || null);
    if (rows.length) {
      parts.push(`<table style="border-collapse:collapse;width:100%;font-size:14px"><tbody>${rows.join('')}</tbody></table>`);
    } else {
      parts.push('<p style="color:#666;font-size:13px">Nessun dato catastale disponibile.</p>');
    }
  }

  if (facts) {
    if (facts.appliedOverrides.length > 0) {
      const items = facts.appliedOverrides
        .map(
          (o) =>
            `<li><strong>${esc(o.field)}</strong> → ${esc(show(o.value))}
             <span style="color:#777">(${esc(o.sourceDocument)}, confidenza ${esc(o.confidence)}): ${esc(o.justification)}</span></li>`,
        )
        .join('');
      parts.push(
        `<p style="font-size:14px;margin:10px 0 4px"><strong>Correzioni applicate ai dati dichiarati</strong> — la stima è stata ricalcolata:</p>
         <ul style="font-size:14px;color:#333;margin:0">${items}</ul>`,
      );
    }
    if (facts.dubbi.length > 0) {
      const items = facts.dubbi
        .map(
          (d) =>
            `<li>${esc(d.campo)}: dichiarato <em>${esc(show(d.dichiarato))}</em> vs rilevato <em>${esc(show(d.rilevato))}</em> — ${esc(d.nota)}</li>`,
        )
        .join('');
      parts.push(
        `<p style="font-size:14px;margin:10px 0 4px"><strong>Dubbi da verificare</strong> — non applicati automaticamente:</p>
         <ul style="font-size:14px;color:#a0410a;margin:0">${items}</ul>`,
      );
    }
    if (facts.sintesi) parts.push(prose(facts.sintesi));
  }

  return parts.join('\n');
}

export function renderValuationReport(data: ValuationReportData): { html: string } {
  const { enrich: e, address, narrative: n } = data;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
  const omi =
    e.omi_eur_mq_min != null && e.omi_eur_mq_max != null
      ? `${fmtEurMq(e.omi_eur_mq_min)} – ${fmtEurMq(e.omi_eur_mq_max)}`
      : 'n/d';

  const narratedNote = n
    ? `<p style="color:#777;font-size:12px;font-style:italic">Relazione narrata generata con assistenza AI sui dati calcolati dal motore.</p>`
    : '';

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px;margin:0 auto;color:#222">
    <h2>Valutazione ${esc(data.referenceId)}</h2>
    <p>${esc(address.normalized ?? address.raw)}${address.comune ? `, ${esc(address.comune)}` : ''}
       — <a href="${mapUrl}">mappa</a></p>
    ${narratedNote}

    <h3>Valore stimato</h3>
    ${rangeBlock(e)}
    ${prose(n?.sintesi)}
    <p style="color:#555;font-size:14px">Superficie commerciale: <strong>${e.superficie_commerciale_mq} m²</strong>
       · €/m² OMI di zona: ${omi} · zona ${esc(e.zona_omi_id ?? 'n/d')} · risoluzione: ${e.fallback_level}</p>
    ${prose(n?.nota_confidenza)}

    <h3>Come si compone</h3>
    ${breakdownTable(e)}
    ${prose(n?.spiegazione_valore)}

    <h3>Comparabili (griglia di omogeneizzazione)</h3>
    ${adjustmentGrid(e)}
    ${prose(n?.commento_comparabili)}

    ${documentiSection(data.catasto, data.documentFacts)}

    <h3>Contesto di mercato</h3>
    <p style="font-size:14px;color:#555">Quotazione OMI di zona ${omi}. I prezzi degli annunci sono di offerta
       e vengono scontati per il margine medio di trattativa prima del confronto. La confidenza riflette
       numero, dispersione e freschezza dei comparabili.</p>
    ${prose(n?.contesto_mercato)}
  </div>`;

  return { html };
}
