import type { EnrichResult, Intent } from '@/lib/valuation/types';

/**
 * Template email (§10), PURI e testabili. Producono { subject, html }.
 * - Scheda agente: l'output di valore della Fase 1 (lead + intent con badge
 *   priorità, indirizzo + mappa, attributi, superficie commerciale, range €/mq
 *   OMI, range stimato + confidence, breakdown voce-per-voce, nota comps, CTA).
 * - Conferma lead: onesta e in-brand (placeholder Delfino).
 */

const eur = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function formatEuro(n: number): string {
  return eur.format(n);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const INTENT_LABEL: Record<Intent, string> = {
  vendere_ora: 'Vuole VENDERE ora',
  vendere_dopo: 'Valuta di vendere',
  comprare_ora: 'Vuole COMPRARE ora',
  comprare_dopo: 'Valuta di comprare',
};

export interface AgentCardData {
  referenceId: string;
  lead: {
    nome: string;
    cognome: string;
    email: string;
    telefono: string;
    intent: Intent;
    isPriority: boolean;
  };
  property: {
    propertyType: string;
    superficieMq: number;
    stanze: number;
    piano: number;
    pianiEdificio: number;
    ascensore: boolean;
    condizioni: string;
    classeEnergetica: string | null;
    hasBalcone: boolean;
    hasGarage: boolean;
    hasGiardino: boolean;
  };
  address: {
    raw: string;
    normalized: string | null;
    comune: string | null;
    cap: string | null;
    lat: number;
    lng: number;
  };
  enrich: EnrichResult | null;
  dashboardUrl: string;
}

function rangeSection(enrich: EnrichResult | null): string {
  if (enrich == null) {
    return `<p style="padding:12px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px">
      ⚠️ <strong>Enrichment non riuscito</strong>: il lead è salvato, la stima va fatta manualmente.</p>`;
  }
  const stima =
    enrich.estimate_min != null && enrich.estimate_max != null
      ? `${formatEuro(enrich.estimate_min)} – ${formatEuro(enrich.estimate_max)}`
      : 'Stima OMI non disponibile per la zona';
  const omi =
    enrich.omi_eur_mq_min != null && enrich.omi_eur_mq_max != null
      ? `${formatEuro(enrich.omi_eur_mq_min)} – ${formatEuro(enrich.omi_eur_mq_max)} /m²`
      : 'n/d';
  const rows = enrich.breakdown
    .map(
      (b) =>
        `<tr><td style="padding:4px 8px;border-top:1px solid #eee">${esc(b.label)}</td>
         <td style="padding:4px 8px;border-top:1px solid #eee;text-align:right">${formatEuro(b.contributo)}</td></tr>`,
    )
    .join('');
  return `
    <p><strong>Range suggerito:</strong> ${stima} &nbsp;
       <span style="background:#e7f5ee;padding:2px 8px;border-radius:10px">Confidenza: ${enrich.confidence.label} (${enrich.confidence.score}/100)</span></p>
    <p>Superficie commerciale: <strong>${enrich.superficie_commerciale_mq} m²</strong> · €/m² OMI: ${omi} ·
       zona ${esc(enrich.zona_omi_id ?? 'n/d')} · fallback: ${enrich.fallback_level}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr><th style="text-align:left;padding:4px 8px">Voce</th><th style="text-align:right;padding:4px 8px">Contributo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#666;font-size:13px;margin-top:8px">Comparabili non disponibili in questa fase — stima su base OMI.</p>`;
}

export function renderAgentCard(data: AgentCardData): { subject: string; html: string } {
  const { lead, property, address } = data;
  const badge = lead.isPriority
    ? `<span style="background:#d6336c;color:#fff;padding:3px 10px;border-radius:10px;font-weight:bold">🔥 PRIORITÀ</span> `
    : '';
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
  const subject = `${lead.isPriority ? '🔥 ' : ''}Nuovo lead valutazione — ${esc(lead.cognome)} (${data.referenceId})`;

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2>Scheda valutazione ${esc(data.referenceId)}</h2>
    <p>${badge}<strong>${INTENT_LABEL[lead.intent]}</strong></p>
    <h3>Contatto</h3>
    <p>${esc(lead.nome)} ${esc(lead.cognome)} · ${esc(lead.email)} · ${esc(lead.telefono)}</p>
    <h3>Immobile</h3>
    <p>${esc(address.normalized ?? address.raw)}${address.comune ? `, ${esc(address.comune)}` : ''}${address.cap ? ` ${esc(address.cap)}` : ''}
       — <a href="${mapUrl}">apri mappa</a></p>
    <p>${esc(property.propertyType)} · ${property.superficieMq} m² · ${property.stanze} locali ·
       piano ${property.piano}/${property.pianiEdificio} · ascensore: ${property.ascensore ? 'sì' : 'no'} ·
       stato: ${esc(property.condizioni)} · classe ${esc(property.classeEnergetica ?? 'n/d')}</p>
    <p>Dotazioni: ${[property.hasBalcone ? 'balcone' : null, property.hasGarage ? 'box/garage' : null, property.hasGiardino ? 'giardino' : null].filter(Boolean).join(', ') || 'nessuna'}</p>
    <h3>Valutazione suggerita</h3>
    ${rangeSection(data.enrich)}
    <p style="margin-top:16px"><a href="${esc(data.dashboardUrl)}"
       style="background:#1c7ed6;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
       Apri in dashboard e inserisci il valore finale</a></p>
  </div>`;

  return { subject, html };
}

export interface LeadConfirmationData {
  referenceId: string;
  nome: string;
}

export function renderLeadConfirmation(data: LeadConfirmationData): { subject: string; html: string } {
  const subject = 'Abbiamo ricevuto la tua richiesta di valutazione';
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
    <h2>Grazie ${esc(data.nome)}!</h2>
    <p>Abbiamo ricevuto la tua richiesta di valutazione. Un nostro consulente Delfino ti
       ricontatta <strong>entro 24h</strong> con la valutazione completa del tuo immobile.</p>
    <p style="color:#666;font-size:13px">Riferimento pratica: ${esc(data.referenceId)}</p>
    <p style="color:#999;font-size:12px">Delfino Real Estate — valutazioni su tutta Italia.</p>
  </div>`;
  return { subject, html };
}
