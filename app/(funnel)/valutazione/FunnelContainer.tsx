'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  firstStep,
  nextStep,
  prevStep,
  progress,
  validateStep,
} from '@/lib/funnel/machine';
import { STEPS } from '@/lib/funnel/steps';
import { toApiPayload } from '@/lib/funnel/to-api-payload';
import type { FunnelData, StepId, ValidationResult } from '@/lib/funnel/types';
import type { ResolvedPlace } from '@/lib/geocoding/types';
import AddressAutocomplete from './components/AddressAutocomplete';
import ProgressBar from './components/ProgressBar';
import ExitIntentModal from './components/ExitIntentModal';
import DocumentUpload from './components/DocumentUpload';

const MapPicker = dynamic(() => import('./components/MapPicker'), {
  ssr: false,
  loading: () => <div style={{ height: 320 }}>Caricamento mappa…</div>,
});

const TIPOLOGIE = [
  { value: 'appartamento', label: 'Appartamento' },
  { value: 'attico', label: 'Attico' },
  { value: 'mansarda', label: 'Mansarda' },
  { value: 'casa_indipendente', label: 'Casa indipendente' },
  { value: 'loft', label: 'Loft' },
  { value: 'rustico_casale', label: 'Rustico / Casale' },
  { value: 'villa', label: 'Villa' },
  { value: 'villetta_schiera', label: 'Villetta a schiera' },
] as const;

const CONDIZIONI = [
  { value: 'nuova', label: 'Nuova' },
  { value: 'ristrutturata', label: 'Ristrutturata' },
  { value: 'parz_ristrutturata', label: 'Parz. ristrutturata' },
  { value: 'da_ristrutturare', label: 'Da ristrutturare' },
] as const;

const ANNI = [
  { value: '<5', label: 'Meno di 5 anni' },
  { value: '5-10', label: '5–10 anni' },
  { value: '>10', label: 'Più di 10 anni' },
] as const;

const PIANO_LABEL = [
  { value: 'terra', label: 'Piano terra' },
  { value: 'rialzato', label: 'Rialzato' },
  { value: 'seminterrato', label: 'Seminterrato' },
  { value: 'interrato', label: 'Interrato' },
] as const;

const RISCALDAMENTO = [
  { value: 'autonomo', label: 'Autonomo' },
  { value: 'centralizzato', label: 'Centralizzato' },
  { value: 'assente', label: 'Assente' },
] as const;

const CLASSI = ['A4', 'A3', 'A2', 'A1', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

const INTENTI = [
  { value: 'vendere_ora', label: 'Vendere ora' },
  { value: 'vendere_dopo', label: 'Vendere più avanti' },
  { value: 'comprare_ora', label: 'Comprare ora' },
  { value: 'comprare_dopo', label: 'Comprare più avanti' },
] as const;

function Choice<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onSelect(o.value)} className="chip" aria-pressed={value === o.value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const numberInput: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 16,
  border: '1px solid var(--line)',
  borderRadius: 10,
  background: 'var(--card)',
  color: 'var(--ink)',
};

export default function FunnelContainer() {
  const [data, setData] = useState<FunnelData>({});
  const [step, setStep] = useState<StepId>(firstStep({}));
  const [errors, setErrors] = useState<ValidationResult['errors']>({});
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof FunnelData>(key: K, value: FunnelData[K] | undefined) {
    setData((d) => {
      const next = { ...d };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const def = STEPS.find((s) => s.id === step)!;
  const p = progress(step, data);

  function goNext() {
    const v = validateStep(step, data);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    const n = nextStep(step, data);
    if (n) setStep(n);
    else void submit();
  }

  function goBack() {
    const prev = prevStep(step, data);
    if (prev) {
      setErrors({});
      setStep(prev);
    }
  }

  function skip() {
    setErrors({});
    const n = nextStep(step, data);
    if (n) setStep(n);
    else void submit();
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/valutazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApiPayload(data)),
      });
      const json = (await res.json()) as { reference_id?: string; error?: string };
      if (!res.ok || !json.reference_id) throw new Error(json.error ?? 'Errore inatteso');
      setReferenceId(json.reference_id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Errore inatteso');
    } finally {
      setSubmitting(false);
    }
  }

  if (referenceId) {
    return (
      <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px 32px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>
            ✓
          </div>
          <h1 className="serif" style={{ fontSize: 30, margin: '0 0 12px' }}>Richiesta ricevuta</h1>
          <p style={{ fontSize: 16.5, color: 'var(--muted)', margin: '0 auto 8px', maxWidth: 420 }}>
            Grazie. Un nostro consulente ti ricontatta <strong style={{ color: 'var(--ink)' }}>entro 24 ore</strong> con
            la valutazione completa del tuo immobile.
          </p>
          <p style={{ color: 'var(--faint)', fontSize: 13.5, margin: '0 0 8px' }}>Riferimento: {referenceId}</p>
        </div>
        <div style={{ marginTop: 20, textAlign: 'left' }}>
          <DocumentUpload referenceId={referenceId} />
        </div>
      </main>
    );
  }

  return (
    <main className="fnl" style={{ maxWidth: 600, margin: '40px auto 64px', padding: '0 20px' }}>
      <ExitIntentModal />
      <Link href="/" style={{ display: 'inline-block', fontSize: 13, color: 'var(--muted)', textDecoration: 'none', marginBottom: 16 }}>
        ← Valutazione immobiliare
      </Link>
      <ProgressBar index={p.index} total={p.total} ratio={p.ratio} />
      <div className="card" style={{ padding: '30px 28px', marginTop: 16 }}>
        <div style={{ minHeight: 230 }}>{renderStep()}</div>

        {submitError && <p style={{ color: '#c0392b', fontSize: 14 }}>{submitError}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={goBack} disabled={prevStep(step, data) === null} style={{ opacity: prevStep(step, data) === null ? 0.4 : 1 }}>
            Indietro
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {def.optional && (
              <button type="button" className="btn btn-ghost" onClick={skip}>
                Salta
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={goNext} disabled={submitting}>
              {step === 'contatti' ? (submitting ? 'Invio…' : 'Invia richiesta') : 'Avanti →'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  function fieldError(key: keyof FunnelData) {
    return errors[key] ? <p style={{ color: '#c92a2a', fontSize: 13, marginTop: 6 }}>{errors[key]}</p> : null;
  }

  function renderStep() {
    switch (step) {
      case 'indirizzo':
        return (
          <section>
            <h2>Dove si trova l’immobile?</h2>
            <AddressAutocomplete
              initial={data.address_raw ?? ''}
              onResolved={(place: ResolvedPlace) => {
                setData((d) => ({
                  ...d,
                  address_raw: place.address_raw,
                  address_normalized: place.address_normalized,
                  lat: place.lat,
                  lng: place.lng,
                  ...(place.comune ? { comune: place.comune } : {}),
                  ...(place.cap ? { cap: place.cap } : {}),
                }));
              }}
            />
            {fieldError('lat')}
          </section>
        );
      case 'mappa':
        return (
          <section>
            <h2>Conferma la posizione</h2>
            <p style={{ color: '#666' }}>Trascina il segnaposto per posizionarlo con precisione.</p>
            {data.lat != null && data.lng != null ? (
              <MapPicker
                lat={data.lat}
                lng={data.lng}
                onChange={(pos) => setData((d) => ({ ...d, lat: pos.lat, lng: pos.lng }))}
              />
            ) : (
              <p>Torna indietro e seleziona un indirizzo.</p>
            )}
            {fieldError('lat')}
          </section>
        );
      case 'tipologia':
        return (
          <section>
            <h2>Che tipo di immobile è?</h2>
            <Choice options={TIPOLOGIE} value={data.property_type} onSelect={(v) => setField('property_type', v)} />
            {fieldError('property_type')}
          </section>
        );
      case 'superficie':
        return (
          <section>
            <h2>Quanti metri quadri?</h2>
            <input
              type="number"
              min={10}
              max={2000}
              value={data.superficie_mq ?? ''}
              onChange={(e) => setField('superficie_mq', e.target.value === '' ? undefined : Number(e.target.value))}
              style={numberInput}
            />
            <input
              type="range"
              min={20}
              max={400}
              value={data.superficie_mq ?? 80}
              onChange={(e) => setField('superficie_mq', Number(e.target.value))}
              style={{ width: '100%', marginTop: 12 }}
            />
            {fieldError('superficie_mq')}
          </section>
        );
      case 'dotazioni':
        return (
          <section>
            <h2>Stanze e dotazioni</h2>
            <label>Numero di stanze</label>
            <input
              type="number"
              min={1}
              max={20}
              value={data.stanze ?? ''}
              onChange={(e) => setField('stanze', e.target.value === '' ? undefined : Number(e.target.value))}
              style={numberInput}
            />
            {fieldError('stanze')}
            <div style={{ marginTop: 16 }}>
              <Choice
                options={[{ value: 'si', label: 'Con ascensore' }, { value: 'no', label: 'Senza ascensore' }] as const}
                value={data.ascensore === undefined ? undefined : data.ascensore ? 'si' : 'no'}
                onSelect={(v) => setField('ascensore', v === 'si')}
              />
              {fieldError('ascensore')}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['balcone', 'garage', 'giardino'] as const).map((k) => {
                const dot = data.dotazioni ?? { balcone: false, garage: false, giardino: false };
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setField('dotazioni', { ...dot, [k]: !dot[k] })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: dot[k] ? '2px solid var(--accent)' : '1px solid var(--line)',
                      background: dot[k] ? 'var(--accent-soft)' : 'var(--card)',
                      cursor: 'pointer',
                    }}
                  >
                    {k === 'garage' ? 'Box / Garage' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                );
              })}
            </div>
          </section>
        );
      case 'condizioni':
        return (
          <section>
            <h2>In che stato è l’immobile?</h2>
            <Choice options={CONDIZIONI} value={data.condizioni} onSelect={(v) => setField('condizioni', v)} />
            {fieldError('condizioni')}
            {data.condizioni === 'ristrutturata' && (
              <div style={{ marginTop: 16 }}>
                <label>Da quanti anni è ristrutturata?</label>
                <Choice options={ANNI} value={data.anni_ristrutturazione} onSelect={(v) => setField('anni_ristrutturazione', v)} />
                {fieldError('anni_ristrutturazione')}
              </div>
            )}
          </section>
        );
      case 'piano':
        return (
          <section>
            <h2>A che piano?</h2>
            <input
              type="number"
              value={data.piano ?? ''}
              onChange={(e) => setField('piano', e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="Piano (es. 3)"
              style={numberInput}
            />
            {fieldError('piano')}
            <div style={{ marginTop: 12 }}>
              <Choice
                options={PIANO_LABEL}
                value={data.piano_label}
                onSelect={(v) => {
                  const numeric = v === 'interrato' ? -2 : v === 'seminterrato' ? -1 : 0;
                  setData((d) => ({ ...d, piano_label: v, piano: numeric }));
                }}
              />
            </div>
            <label style={{ display: 'block', marginTop: 16 }}>Piani totali dell’edificio</label>
            <input
              type="number"
              min={1}
              value={data.piani_edificio ?? ''}
              onChange={(e) => setField('piani_edificio', e.target.value === '' ? undefined : Number(e.target.value))}
              style={numberInput}
            />
            {fieldError('piani_edificio')}
          </section>
        );
      case 'riscaldamento':
        return (
          <section>
            <h2>Tipo di riscaldamento (opzionale)</h2>
            <Choice options={RISCALDAMENTO} value={data.riscaldamento} onSelect={(v) => setField('riscaldamento', v)} />
          </section>
        );
      case 'classe_energetica':
        return (
          <section>
            <h2>Classe energetica (opzionale)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CLASSI.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField('classe_energetica', c)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: data.classe_energetica === c ? '2px solid var(--accent)' : '1px solid var(--line)',
                    background: data.classe_energetica === c ? 'var(--accent-soft)' : 'var(--card)',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>
        );
      case 'intento':
        return (
          <section>
            <h2>Cosa vorresti fare?</h2>
            <Choice options={INTENTI} value={data.intent} onSelect={(v) => setField('intent', v)} />
            {fieldError('intent')}
          </section>
        );
      case 'contatti':
        return (
          <section>
            <h2>I tuoi contatti</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Nome" value={data.nome ?? ''} onChange={(e) => setField('nome', e.target.value || undefined)} style={numberInput} />
              {fieldError('nome')}
              <input placeholder="Cognome" value={data.cognome ?? ''} onChange={(e) => setField('cognome', e.target.value || undefined)} style={numberInput} />
              {fieldError('cognome')}
              <input placeholder="Email" type="email" value={data.email ?? ''} onChange={(e) => setField('email', e.target.value || undefined)} style={numberInput} />
              {fieldError('email')}
              <input placeholder="Telefono" value={data.telefono ?? ''} onChange={(e) => setField('telefono', e.target.value || undefined)} style={numberInput} />
              {fieldError('telefono')}
            </div>
            <label style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={data.consent_privacy ?? false} onChange={(e) => setField('consent_privacy', e.target.checked)} />
              <span style={{ fontSize: 14 }}>Acconsento al trattamento dei dati (privacy) *</span>
            </label>
            {fieldError('consent_privacy')}
            <label style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={data.consent_marketing ?? false} onChange={(e) => setField('consent_marketing', e.target.checked)} />
              <span style={{ fontSize: 14 }}>Acconsento a ricevere comunicazioni (opzionale)</span>
            </label>
          </section>
        );
    }
  }
}
