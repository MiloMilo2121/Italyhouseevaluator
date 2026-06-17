import type { EnrichResult } from '@/lib/valuation/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';
import type { Perizia } from './types';

/**
 * Render PURO della perizia (HTML pronto-stampa). Interleava le SEZIONI di prosa
 * (scritte dall'LLM) coi NUMERI AUTOREVOLI + tabelle costruite dal motore (range,
 * breakdown, comparabili, catasto, correzioni documentali): le tabelle/"grafici"
 * sono create da zero dai dati del motore, l'LLM non produce cifre. Degrada se la
 * perizia non è ancora stata generata (mostra i numeri + nota).
 */

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
function fmtEur(n: number): string {
  return eur.format(n);
}
function fmtEurMq(n: number): string {
  return `${eur.format(n)}/m²`;
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function show(v: unknown): string {
  return v == null || v === '' ? 'n/d' : String(v);
}

export interface PeriziaReportData {
  referenceId: string;
  address: { normalized: string | null; raw: string; comune: string | null; lat: number; lng: number };
  propertyType: string | null;
  superficieDichiarataMq: number | null;
  enrich: EnrichResult;
  catasto: CatastoData | null;
  documentFacts: DocumentFacts | null;
  perizia: Perizia | null;
}

function prose(text: string | undefined): string {
  if (!text) return '';
  return `<p style="font-size:14px;line-height:1.6;color:#222;margin:6px 0">${esc(text)}</p>`;
}

function section(title: string, body: string): string {
  return `<section style="margin:18px 0"><h3 style="border-bottom:1px solid #e9ecef;padding-bottom:4px">${esc(title)}</h3>${body}</section>`;
}

function kvTable(rows: [string, string | number | null][]): string {
  const trs = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border-top:1px solid #eee">${esc(k)}</td>
         <td style="padding:4px 8px;border-top:1px solid #eee;text-align:right">${esc(String(v))}</td></tr>`,
    )
    .join('');
  return trs ? `<table style="border-collapse:collapse;width:100%;font-size:14px"><tbody>${trs}</tbody></table>` : '';
}

function rangeBlock(e: EnrichResult): string {
  if (e.estimate_min == null || e.estimate_max == null) {
    return `<p style="padding:12px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px">
      Stima non disponibile su base OMI per questa zona (fallback: ${esc(e.fallback_level)}).</p>`;
  }
  return `<p style="font-size:20px"><strong>${fmtEur(e.estimate_min)} – ${fmtEur(e.estimate_max)}</strong>
    &nbsp;<span style="background:#e7f5ee;padding:2px 8px;border-radius:10px">Confidenza: ${esc(e.confidence.label)} (${e.confidence.score}/100)</span></p>`;
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

function compsGrid(e: EnrichResult): string {
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
          <td style="padding:4px 8px">${esc(c.stato)}</td>
          <td style="padding:4px 8px;text-align:right">${fmtEurMq(c.rawEurMq)}</td>
          <td style="padding:4px 8px;text-align:right">${fmtEurMq(c.discountedEurMq)}</td>
          <td style="padding:4px 8px;text-align:right"><strong>${fmtEurMq(c.correctedEurMq)}</strong></td>
          <td style="padding:4px 8px;text-align:right">${c.weight.toFixed(2)}</td>
        </tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <p style="color:#777;font-size:12px;margin-top:8px">Comparabili sintetici attribuiti (annunci pubblici / dati di mercato), corretti per lo scarto offerta→rogito e omogeneizzati verso l'immobile.</p>`;
}

function catastoTable(c: CatastoData): string {
  const ident = [c.foglio, c.particella, c.subalterno].filter(Boolean).join(' / ');
  return kvTable([
    ['Categoria', c.categoria],
    ['Classe', c.classe],
    ['Consistenza (vani)', c.consistenzaVani],
    ['Rendita', c.renditaEuro != null ? fmtEur(c.renditaEuro) : null],
    ['Superficie catastale', c.superficieCatastaleMq != null ? `${c.superficieCatastaleMq} m²` : null],
    ['Foglio / Particella / Sub', ident || null],
  ]);
}

function documentFactsBlock(f: DocumentFacts): string {
  const parts: string[] = [];
  if (f.appliedOverrides.length > 0) {
    const items = f.appliedOverrides
      .map(
        (o) =>
          `<li><strong>${esc(o.field)}</strong> → ${esc(show(o.value))} <span style="color:#777">(${esc(o.sourceDocument)}, ${esc(o.confidence)})</span></li>`,
      )
      .join('');
    parts.push(`<p style="font-size:14px;margin:8px 0 4px"><strong>Correzioni applicate</strong> (stima ricalcolata):</p><ul style="font-size:14px;color:#333;margin:0">${items}</ul>`);
  }
  if (f.dubbi.length > 0) {
    const items = f.dubbi
      .map((d) => `<li>${esc(d.campo)}: dichiarato <em>${esc(show(d.dichiarato))}</em> vs rilevato <em>${esc(show(d.rilevato))}</em> — ${esc(d.nota)}</li>`)
      .join('');
    parts.push(`<p style="font-size:14px;margin:8px 0 4px"><strong>Dubbi da verificare</strong>:</p><ul style="font-size:14px;color:#a0410a;margin:0">${items}</ul>`);
  }
  return parts.join('\n');
}

export function renderPerizia(data: PeriziaReportData): { html: string } {
  const { enrich: e, address, perizia: p } = data;
  const s = p?.sections ?? null;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
  const omi =
    e.omi_eur_mq_min != null && e.omi_eur_mq_max != null
      ? `${fmtEurMq(e.omi_eur_mq_min)} – ${fmtEurMq(e.omi_eur_mq_max)}`
      : 'n/d';

  const banner = p
    ? `<p style="color:#777;font-size:12px;font-style:italic">Perizia redatta con assistenza AI sui dati calcolati dal motore (${esc(p.model ?? 'modello n/d')}, ${esc(p.generatedAt.slice(0, 10))}).</p>`
    : `<p style="padding:10px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;font-size:13px">Perizia non ancora generata — usa il pulsante "Genera perizia" nella scheda. Sotto i dati del motore.</p>`;

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:820px;margin:0 auto;color:#222">
    <h2>Perizia di valutazione ${esc(data.referenceId)}</h2>
    <p>${esc(address.normalized ?? address.raw)}${address.comune ? `, ${esc(address.comune)}` : ''} — <a href="${mapUrl}">mappa</a></p>
    ${banner}

    ${section('Premessa', prose(s?.premessa))}
    ${section(
      'Identificazione dell’immobile',
      prose(s?.identificazione_immobile) +
        kvTable([
          ['Tipologia', data.propertyType],
          ['Indirizzo', address.normalized ?? address.raw],
          ['Superficie dichiarata', data.superficieDichiarataMq != null ? `${data.superficieDichiarataMq} m²` : null],
          ['Superficie commerciale', `${e.superficie_commerciale_mq} m²`],
          ['Zona OMI', e.zona_omi_id],
        ]),
    )}
    ${section('Descrizione', prose(s?.descrizione))}
    ${section('Dati catastali', prose(s?.dati_catastali) + (data.catasto ? catastoTable(data.catasto) : '<p style="color:#666;font-size:13px">Dati catastali non disponibili.</p>'))}
    ${section(
      'Analisi di mercato',
      prose(s?.analisi_mercato) +
        `<p style="font-size:14px;color:#555">Quotazione OMI di zona: ${omi} · risoluzione: ${esc(e.fallback_level)}.</p>`,
    )}
    ${section('Analisi dei comparabili', prose(s?.analisi_comparabili) + compsGrid(e))}
    ${section('Considerazioni documentali', prose(s?.considerazioni_documentali) + (data.documentFacts ? documentFactsBlock(data.documentFacts) : '<p style="color:#666;font-size:13px">Nessun documento analizzato.</p>'))}
    ${section('Metodo valutativo', prose(s?.metodo_valutativo) + breakdownTable(e))}
    ${section('Conclusione: valore di stima', rangeBlock(e) + prose(s?.conclusione_valore))}
    ${section('Limiti e assunzioni', prose(s?.limiti_assunzioni))}
  </div>`;

  return { html };
}
