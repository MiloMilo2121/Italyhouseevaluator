import { z } from 'zod';
import { OVERRIDE_FIELDS } from './types';
import type { ReconcilerInput } from './types';

/**
 * Logica PURA del layer documenti (node-testabile, niente rete/SDK):
 *  - system prompt di grounding ("estrai solo il leggibile; non inventare"),
 *  - JSON schema per lo structured output (`jsonSchemaOutputFormat`),
 *  - zod schema (v3) per ri-validare `parsed_output` a runtime,
 *  - builder del prompt utente del reconciler (testo, come la narrazione).
 *
 * I content block immagine/PDF della vision sono assemblati nell'adapter
 * (`anthropic-vision.ts`) — qui restano solo le istruzioni testuali, pure.
 */

const CONFIDENCE = ['alta', 'media', 'bassa'] as const;
const nullableStr = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const nullableNum = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const;

// ---- APE (vision) ----
export const APE_SYSTEM = [
  "Sei un perito che legge un Attestato di Prestazione Energetica (APE) italiano.",
  'Estrai SOLO i dati chiaramente leggibili dal documento.',
  '- Se un dato non è leggibile, restituisci null e imposta leggibile=false.',
  '- NON inventare la classe energetica né i consumi: usa solo ciò che vedi.',
  '- confidence: "alta" se i campi sono nitidi e inequivocabili, altrimenti "media"/"bassa".',
].join('\n');

export const APE_INSTRUCTION =
  'Estrai dall\'APE la classe energetica e l\'indice EPgl,nren (kWh/m²·anno) se leggibili.';

export const APE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    classeEnergetica: nullableStr,
    epglNrenKwhMqAnno: nullableNum,
    leggibile: { type: 'boolean' },
    confidence: { type: 'string', enum: [...CONFIDENCE] },
  },
  required: ['classeEnergetica', 'epglNrenKwhMqAnno', 'leggibile', 'confidence'],
} as const;

export const ApeSchema = z.object({
  classeEnergetica: z.string().nullable(),
  epglNrenKwhMqAnno: z.number().nullable(),
  leggibile: z.boolean(),
  confidence: z.enum(CONFIDENCE),
});

// ---- Planimetria (vision) ----
export const PLANIMETRIA_SYSTEM = [
  'Sei un tecnico che legge una planimetria (catastale o di progetto) di un immobile.',
  'Estrai SOLO ciò che è leggibile dal disegno e dalle quote.',
  '- Conta i vani principali; estrai la superficie calpestabile solo se quotata.',
  '- Elenca i locali riconoscibili (es. "cucina", "camera", "bagno").',
  '- Se incerto, usa confidence bassa; se illeggibile, leggibile=false. NON inventare misure.',
].join('\n');

export const PLANIMETRIA_INSTRUCTION =
  'Estrai dalla planimetria: numero di vani, superficie calpestabile (se quotata) e l\'elenco dei locali.';

export const PLANIMETRIA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    vani: nullableNum,
    superficieCalpestabileMq: nullableNum,
    locali: { type: 'array', items: { type: 'string' } },
    leggibile: { type: 'boolean' },
    confidence: { type: 'string', enum: [...CONFIDENCE] },
  },
  required: ['vani', 'superficieCalpestabileMq', 'locali', 'leggibile', 'confidence'],
} as const;

export const PlanimetriaSchema = z.object({
  vani: z.number().nullable(),
  superficieCalpestabileMq: z.number().nullable(),
  locali: z.array(z.string()),
  leggibile: z.boolean(),
  confidence: z.enum(CONFIDENCE),
});

// ---- Reconciler (text-only) ----
export const RECONCILER_SYSTEM = [
  "Sei un analista immobiliare. Confronti i dati DICHIARATI dal proprietario con i FATTI",
  'estratti dai documenti (APE, planimetria, catasto, note vocali) e produci due cose:',
  '1) `overrides`: correzioni agli input SOLO quando un documento è fonte fattuale affidabile',
  '   e diverge dal dichiarato (es. classe APE ufficiale, categoria/ superficie catastale).',
  '2) `dubbi`: tutto ciò che è incerto, contraddittorio o non fattuale — da mostrare all\'agente.',
  '',
  'Regole tassative:',
  `- field DEVE essere uno tra: ${OVERRIDE_FIELDS.join(', ')}. value SEMPRE come stringa.`,
  '- Proponi un override SOLO se affidabile; nel dubbio usa `dubbi`, NON `overrides`.',
  '- confidence "alta" solo per fatti documentali inequivocabili (APE/catasto ufficiali).',
  '- NON proporre stime o prezzi. NON inventare: usa solo i fatti forniti.',
  '- Indica sempre sourceDocument e una justification sintetica per ogni override.',
].join('\n');

export const RECONCILER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overrides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: { type: 'string', enum: [...OVERRIDE_FIELDS] },
          value: { type: 'string' },
          confidence: { type: 'string', enum: [...CONFIDENCE] },
          sourceDocument: { type: 'string' },
          justification: { type: 'string' },
        },
        required: ['field', 'value', 'confidence', 'sourceDocument', 'justification'],
      },
    },
    dubbi: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          campo: { type: 'string' },
          dichiarato: nullableStr,
          rilevato: nullableStr,
          nota: { type: 'string' },
        },
        required: ['campo', 'dichiarato', 'rilevato', 'nota'],
      },
    },
    sintesi: { type: 'string' },
  },
  required: ['overrides', 'dubbi', 'sintesi'],
} as const;

export const ReconciliationSchema = z.object({
  overrides: z.array(
    z.object({
      field: z.enum(OVERRIDE_FIELDS as unknown as [string, ...string[]]),
      value: z.unknown(),
      confidence: z.enum(CONFIDENCE),
      sourceDocument: z.string(),
      justification: z.string(),
    }),
  ),
  dubbi: z.array(
    z.object({
      campo: z.string(),
      dichiarato: z.unknown(),
      rilevato: z.unknown(),
      nota: z.string(),
    }),
  ),
  sintesi: z.string(),
});

/** Prompt utente del reconciler: payload di confronto serializzato (no prosa libera). */
export function buildReconcilerUserContent(input: ReconcilerInput): string {
  return [
    'Confronta i DICHIARATI con i FATTI estratti e produci overrides + dubbi + sintesi.',
    'Usa SOLO i dati qui sotto (JSON). Non aggiungere fatti non presenti.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n');
}
