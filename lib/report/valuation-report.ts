import type { AppliedCorrection, EnrichResult, ZoneIntelligence } from '@/lib/valuation/types';
import type { ValuationNarrative } from '@/lib/narration/types';
import type { CatastoData, DocumentFacts } from '@/lib/documents/types';
import type { Perizia } from '@/lib/perizia/types';

/**
 * Rapporto di valutazione (V2) — HTML self-contained, design editoriale GENERICO
 * (nessun brand/logo), pronto-stampa. Due varianti:
 *  - 'agent'  : completo/denso (breakdown, griglia comparabili, contesto zona,
 *               correzione tracciata, catasto, perizia) per l'agente;
 *  - 'client' : più corto ma completo (valore, sintesi, composizione essenziale,
 *               contesto di mercato) per il cliente.
 * I NUMERI sono del motore deterministico; l'LLM (narrative/perizia) spiega.
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

export type ReportVariant = 'agent' | 'client';

export interface ValuationReportData {
  referenceId: string;
  address: { normalized: string | null; raw: string; comune: string | null; lat: number; lng: number };
  enrich: EnrichResult;
  narrative?: ValuationNarrative | null;
  catasto?: CatastoData | null;
  documentFacts?: DocumentFacts | null;
  perizia?: Perizia | null;
  zoneIntelligence?: ZoneIntelligence | null;
  correction?: AppliedCorrection | null;
  /** Data di generazione (ISO o leggibile). Default: oggi a render-time. */
  generatedAt?: string;
}

const STYLE = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;450;500;600&display=swap');
.vr{
  --ink:#1b1a17;--paper:#faf8f2;--card:#ffffff;--muted:#6c6862;--faint:#8c887f;
  --line:#e7e2d6;--line2:#efebe1;--accent:#1f5c52;--accent-soft:#e9f1ee;
  --amber:#8a5a14;--amber-soft:#f8efdd;--green:#2f6f4f;--green-soft:#e7f1ea;
  --serif:'Fraunces',Georgia,'Times New Roman',serif;--sans:'Geist',system-ui,-apple-system,sans-serif;
  font-family:var(--sans);color:var(--ink);background:var(--paper);
  max-width:820px;margin:0 auto;padding:48px 40px 64px;line-height:1.55;
  -webkit-font-smoothing:antialiased;font-size:15px;
}
.vr *{box-sizing:border-box}
.vr-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 6px}
.vr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:1px solid var(--ink);padding-bottom:18px;margin-bottom:34px}
.vr-title{font-family:var(--serif);font-weight:500;font-size:26px;letter-spacing:-.01em;margin:0}
.vr-meta{text-align:right;font-size:12.5px;color:var(--muted);white-space:nowrap}
.vr-meta b{color:var(--ink);font-variant-numeric:tabular-nums}
.vr section{margin:38px 0}
.vr h3{font-family:var(--serif);font-weight:500;font-size:19px;margin:0 0 14px;letter-spacing:-.01em}
.vr-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:30px 32px;box-shadow:0 1px 0 rgba(27,26,23,.02),0 12px 30px -22px rgba(27,26,23,.25)}
.vr-value{font-family:var(--serif);font-weight:500;font-size:46px;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:2px 0 0}
.vr-value .dash{color:var(--faint);margin:0 .12em;font-weight:400}
.vr-sub{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:16px;font-size:13.5px;color:var(--muted)}
.vr-sub b{color:var(--ink);font-variant-numeric:tabular-nums}
.vr-pill{display:inline-flex;align-items:center;gap:6px;background:var(--accent-soft);color:var(--accent);
  border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:500}
.vr-pill.amber{background:var(--amber-soft);color:var(--amber)}
.vr-addr{font-size:14.5px;color:var(--ink);margin:0 0 2px}
.vr-addr a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-soft)}
table.vr-t{border-collapse:collapse;width:100%;font-size:13.5px}
.vr-t th{text-align:left;font-weight:600;color:var(--faint);font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  padding:0 10px 8px;border-bottom:1px solid var(--line)}
.vr-t td{padding:9px 10px;border-bottom:1px solid var(--line2);font-variant-numeric:tabular-nums}
.vr-t td.r,.vr-t th.r{text-align:right}
.vr-t tr.total td{border-top:1.5px solid var(--ink);border-bottom:none;font-weight:600;font-size:14.5px;padding-top:11px}
.vr-prose{font-size:14.5px;line-height:1.62;color:#33312c;margin:10px 0}
.vr-note{font-size:12px;color:var(--faint);font-style:italic}
.vr-callout{border-radius:10px;padding:14px 16px;font-size:13.5px;margin:10px 0}
.vr-callout.warn{background:var(--amber-soft);border:1px solid #ecdcb8;color:#5f3f0e}
.vr-callout.ok{background:var(--green-soft);border:1px solid #cfe4d6;color:#234e38}
.vr-callout.flat{background:var(--card);border:1px solid var(--line)}
.vr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:13.5px}
.vr-grid2 .k{color:var(--muted)} .vr-grid2 .v{text-align:right;font-variant-numeric:tabular-nums}
.vr-src{font-size:11.5px;color:var(--faint);margin-top:8px}
.vr-src a{color:var(--accent);text-decoration:none}
.vr-foot{margin-top:48px;border-top:1px solid var(--line);padding-top:14px;font-size:11.5px;color:var(--faint);display:flex;justify-content:space-between;gap:16px}
@media print{.vr{background:#fff;padding:24px 0}.vr-hero{box-shadow:none}}
</style>`;

function prose(text: string | undefined | null): string {
  return text ? `<p class="vr-prose">${esc(text)}</p>` : '';
}

function heroSection(d: ValuationReportData): string {
  const e = d.enrich;
  const omi =
    e.omi_eur_mq_min != null && e.omi_eur_mq_max != null
      ? `${fmtEurMq(e.omi_eur_mq_min)} – ${fmtEurMq(e.omi_eur_mq_max)}`
      : 'n/d';
  const value =
    e.estimate_min != null && e.estimate_max != null
      ? `<div class="vr-value">${fmtEur(e.estimate_min)}<span class="dash">–</span>${fmtEur(e.estimate_max)}</div>`
      : `<div class="vr-callout warn">Stima non disponibile su base OMI per questa zona (risoluzione: ${esc(e.fallback_level)}).</div>`;
  const conf =
    e.estimate_min != null
      ? `<span class="vr-pill">Confidenza ${esc(e.confidence.label)} · ${e.confidence.score}/100</span>`
      : '';
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${d.address.lat},${d.address.lng}`;
  return `
  <section class="vr-hero">
    <p class="vr-eyebrow">Più probabile valore di mercato</p>
    ${value}
    <div class="vr-sub">
      ${conf}
      <span>Superficie commerciale <b>${e.superficie_commerciale_mq} m²</b></span>
      <span>€/m² OMI di zona <b>${omi}</b></span>
      <span>Zona <b>${esc(e.zona_omi_id ?? 'n/d')}</b></span>
    </div>
    <p class="vr-addr" style="margin-top:18px">${esc(d.address.normalized ?? d.address.raw)}${d.address.comune ? `, ${esc(d.address.comune)}` : ''} · <a href="${mapUrl}">mappa</a></p>
  </section>`;
}

function breakdownSection(e: EnrichResult): string {
  if (e.breakdown.length === 0) return '';
  const rows = e.breakdown
    .map((b, i, arr) => {
      const isTotal = i === arr.length - 1 && /riferimento|valore finale/i.test(b.label);
      return `<tr${isTotal ? ' class="total"' : ''}><td>${esc(b.label)}</td><td class="r">${fmtEur(b.contributo)}</td></tr>`;
    })
    .join('');
  return `
  <section>
    <p class="vr-eyebrow">01 · Composizione</p>
    <h3>Come si compone il valore</h3>
    <table class="vr-t"><tbody>${rows}</tbody></table>
  </section>`;
}

function comparablesSection(e: EnrichResult, variant: ReportVariant): string {
  if (e.comparables.length === 0) {
    return `<section><p class="vr-eyebrow">02 · Comparabili</p><h3>Mercato comparabile</h3>
      <p class="vr-prose">Comparabili non disponibili per questa zona: la stima poggia sulle quotazioni OMI ufficiali.</p></section>`;
  }
  if (variant === 'client') {
    const n = e.comparables.length;
    const mq = e.comparables.map((c) => c.correctedEurMq);
    const min = Math.min(...mq);
    const max = Math.max(...mq);
    return `<section><p class="vr-eyebrow">02 · Comparabili</p><h3>Mercato comparabile</h3>
      <p class="vr-prose">L'analisi considera <b>${n}</b> immobili simili nella zona, con valori omogeneizzati
      tra ${fmtEurMq(min)} e ${fmtEurMq(max)}, corretti per stato, piano e caratteristiche rispetto all'immobile in esame.</p></section>`;
  }
  const head = ['Rif.', 'Dist.', 'Data', 'Stato', '€/m² offerta', '€/m² scontato', '€/m² omog.', 'Peso']
    .map((h, i) => `<th${i >= 4 ? ' class="r"' : ''}>${h}</th>`)
    .join('');
  const rows = e.comparables
    .map(
      (c, i) => `<tr>
        <td>#${i + 1}</td><td>${Math.round(c.distanceMeters)} m</td><td>${esc(c.saleDate.slice(0, 10))}</td><td>${c.stato}</td>
        <td class="r">${fmtEurMq(c.rawEurMq)}</td><td class="r">${fmtEurMq(c.discountedEurMq)}</td>
        <td class="r"><b>${fmtEurMq(c.correctedEurMq)}</b></td><td class="r">${c.weight.toFixed(2)}</td></tr>`,
    )
    .join('');
  return `
  <section>
    <p class="vr-eyebrow">02 · Comparabili</p>
    <h3>Griglia di omogeneizzazione</h3>
    <table class="vr-t"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <p class="vr-note">Da annunci pubblici aggregati internamente; prezzi di offerta scontati per il margine di trattativa e omogeneizzati verso l'immobile.</p>
  </section>`;
}

function zoneSection(zi: ZoneIntelligence | null | undefined, variant: ReportVariant): string {
  if (!zi) return '';
  const dev =
    zi.omi_deviation_flag === 'aligned'
      ? '<span class="vr-pill ok" style="background:var(--green-soft);color:var(--green)">Prezzi web in linea con l\'OMI</span>'
      : zi.omi_deviation_flag === 'web_higher'
        ? '<span class="vr-pill amber">Prezzi web sopra l\'OMI</span>'
        : zi.omi_deviation_flag === 'web_lower'
          ? '<span class="vr-pill amber">Prezzi web sotto l\'OMI</span>'
          : '';
  const web =
    zi.web_eur_mq_min != null && zi.web_eur_mq_max != null
      ? `<span>Prezzi web osservati <b>${fmtEurMq(zi.web_eur_mq_min)} – ${fmtEurMq(zi.web_eur_mq_max)}</b></span>`
      : '';
  const sources =
    variant === 'agent' && zi.sources.length
      ? `<p class="vr-src">Fonti: ${zi.sources.slice(0, 4).map((s) => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(' · ')}</p>`
      : '';
  return `
  <section>
    <p class="vr-eyebrow">03 · Contesto di zona</p>
    <h3>Appetibilità e mercato della zona</h3>
    <div class="vr-sub" style="margin-bottom:10px">
      <span class="vr-pill">Appetibilità ${esc(zi.desirability_label)} · ${zi.desirability_score}/100</span>
      ${dev} ${web}
    </div>
    ${prose(zi.note_qualitative)}
    ${zi.venduto_recente ? `<p class="vr-prose"><b>Venduto recente.</b> ${esc(zi.venduto_recente)}</p>` : ''}
    ${zi.vendibile_recente ? `<p class="vr-prose"><b>Offerta attuale.</b> ${esc(zi.vendibile_recente)}</p>` : ''}
    ${sources}
    <p class="vr-note">Contesto da ricerca web; i valori restano ancorati alle quotazioni ufficiali.</p>
  </section>`;
}

/** Correzione tracciata — solo variante agente (diagnostica interna). */
function correctionSection(c: AppliedCorrection | null | undefined, e: EnrichResult): string {
  if (!c || c.factor_applied === 1) return '';
  const detMin = e.estimate_deterministic_min;
  const detMax = e.estimate_deterministic_max;
  const det = detMin != null && detMax != null ? `${fmtEur(detMin)} – ${fmtEur(detMax)}` : 'n/d';
  const pct = ((c.factor_applied - 1) * 100).toFixed(1);
  return `
  <section>
    <p class="vr-eyebrow">Correzione di contesto (tracciata)</p>
    <div class="vr-callout flat">
      <p style="margin:0 0 6px"><b>Fattore ${c.factor_applied} (${pct}%)</b>${c.clamped ? ' · clampato al limite' : ''} — modello ${esc(c.model)}</p>
      <p style="margin:0 0 6px">${esc(c.motivazione)}</p>
      <p class="vr-note" style="margin:0">Valore deterministico pre-correzione: ${det}. La correzione è vincolata entro una banda e applicata in modo riproducibile.</p>
    </div>
  </section>`;
}

function documentiSection(catasto: CatastoData | null | undefined, facts: DocumentFacts | null | undefined): string {
  if (catasto == null && facts == null) return '';
  const parts: string[] = ['<p class="vr-eyebrow">04 · Documenti &amp; catasto</p><h3>Verifica documentale</h3>'];
  if (catasto) {
    const rows: string[] = [];
    const add = (k: string, v: string | number | null): void => {
      if (v != null && v !== '') rows.push(`<div class="k">${esc(k)}</div><div class="v">${esc(String(v))}</div>`);
    };
    add('Categoria', catasto.categoria);
    add('Classe', catasto.classe);
    add('Consistenza (vani)', catasto.consistenzaVani);
    add('Rendita', catasto.renditaEuro != null ? fmtEur(catasto.renditaEuro) : null);
    add('Superficie catastale', catasto.superficieCatastaleMq != null ? `${catasto.superficieCatastaleMq} m²` : null);
    const ident = [catasto.foglio, catasto.particella, catasto.subalterno].filter(Boolean).join(' / ');
    add('Foglio / Part. / Sub', ident || null);
    if (rows.length) parts.push(`<div class="vr-grid2">${rows.join('')}</div>`);
  }
  if (facts) {
    for (const o of facts.appliedOverrides ?? []) {
      parts.push(`<div class="vr-callout ok">Corretto <b>${esc(o.field)}</b> → ${esc(show(o.value))} <span class="vr-note">(${esc(o.sourceDocument)}: ${esc(o.justification)})</span></div>`);
    }
    for (const d of facts.dubbi ?? []) {
      parts.push(`<div class="vr-callout warn">${esc(d.campo)}: dichiarato <em>${esc(show(d.dichiarato))}</em> vs rilevato <em>${esc(show(d.rilevato))}</em> — ${esc(d.nota)}</div>`);
    }
    if (facts.sintesi) parts.push(prose(facts.sintesi));
  }
  return `<section>${parts.join('\n')}</section>`;
}

function periziaSection(p: Perizia | null | undefined): string {
  if (!p?.sections) return '';
  const body = Object.entries(p.sections)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(
      ([k, v]) =>
        `<h4 style="font-family:var(--serif);font-weight:500;font-size:15px;margin:18px 0 4px;text-transform:capitalize">${esc(k.replace(/_/g, ' '))}</h4>${prose(v as string)}`,
    )
    .join('');
  if (!body) return '';
  return `<section><p class="vr-eyebrow">Perizia interna</p><h3>Relazione estimativa</h3>${body}</section>`;
}

export function renderValuationReport(
  data: ValuationReportData,
  variant: ReportVariant = 'agent',
): { html: string } {
  const e = data.enrich;
  const n = data.narrative;
  const generated = data.generatedAt ?? new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date());
  const omi =
    e.omi_eur_mq_min != null && e.omi_eur_mq_max != null ? `${fmtEurMq(e.omi_eur_mq_min)} – ${fmtEurMq(e.omi_eur_mq_max)}` : 'n/d';

  const head = `
  <div class="vr-head">
    <div>
      <p class="vr-eyebrow">Rapporto di valutazione</p>
      <h1 class="vr-title">Valutazione immobiliare</h1>
    </div>
    <div class="vr-meta">Rif. <b>${esc(data.referenceId)}</b><br>${esc(generated)}</div>
  </div>`;

  const contextProse = `
  <section>
    <p class="vr-eyebrow">${data.zoneIntelligence ? '05' : '03'} · Contesto di mercato</p>
    <h3>Metodologia e mercato</h3>
    <p class="vr-prose">Quotazione OMI di zona ${omi}. I prezzi degli annunci sono di offerta e vengono scontati per il
      margine medio di trattativa prima del confronto; la confidenza riflette numero, dispersione e freschezza dei comparabili.</p>
    ${prose(n?.contesto_mercato)}
  </section>`;

  const agentBody = `
    ${heroSection(data)}
    ${prose(n?.sintesi)}
    ${prose(n?.nota_confidenza)}
    ${breakdownSection(e)}
    ${prose(n?.spiegazione_valore)}
    ${comparablesSection(e, 'agent')}
    ${prose(n?.commento_comparabili)}
    ${zoneSection(data.zoneIntelligence, 'agent')}
    ${correctionSection(data.correction, e)}
    ${documentiSection(data.catasto, data.documentFacts)}
    ${contextProse}
    ${periziaSection(data.perizia)}`;

  const clientBody = `
    ${heroSection(data)}
    ${prose(n?.sintesi)}
    ${breakdownSection(e)}
    ${comparablesSection(e, 'client')}
    ${zoneSection(data.zoneIntelligence, 'client')}
    ${contextProse}`;

  const aiNote = n ? ' · relazione redatta con assistenza AI sui dati del motore' : '';
  const html = `${STYLE}<div class="vr">${head}${variant === 'agent' ? agentBody : clientBody}
    <div class="vr-foot"><span>Rif. ${esc(data.referenceId)}</span><span>Documento generato automaticamente · i valori non costituiscono perizia giurata${aiNote}</span></div>
  </div>`;
  return { html };
}
