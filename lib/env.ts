import { z } from 'zod';

/**
 * Env validato e fail-fast. Diviso tra public (sicuro lato client) e
 * server-only (mai esposto al browser). Importare `serverEnv` SOLO da codice
 * server-side; importarlo in un componente client farebbe leakare la
 * service-role key.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  AGENT_NOTIFICATION_EMAIL: z.string().email().optional(),
  GEOCODING_PROVIDER: z.enum(['google', 'nominatim']).default('google'),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  VALUATION_MODEL_VERSION: z.coerce.number().int().positive().default(1),
  // V2 Step 2: narrazione LLM (on-demand in dashboard). Senza key il
  // NullNarrator degrada (il report mostra solo i numeri deterministici).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  NARRATION_MODEL: z.string().min(1).optional(),
  // V2 Step 3 (Filone 2): document intelligence. Tutto gated/null-degrade:
  // senza le chiavi gli estrattori ritornano null e il pipeline doc resta inerte.
  // Vision (planimetrie/APE) + reconciler usano ANTHROPIC_API_KEY sopra.
  VISION_MODEL: z.string().min(1).optional(),
  RECONCILER_MODEL: z.string().min(1).optional(),
  // 'parse' = messages.parse + structured output (default); 'create' = fallback
  // messages.create + JSON.parse manuale (se il combo PDF+structured output
  // dovesse comportarsi diversamente lato server).
  VISION_PARSE_MODE: z.enum(['parse', 'create']).default('parse'),
  // Trascrizione note vocali (OpenAI Whisper). Nuovo fornitore, gated.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  WHISPER_MODEL: z.string().min(1).optional(),
  // Lookup catastale deterministico (provider OpenAPI-style, seam configurabile).
  CATASTO_BASE_URL: z.string().url().optional(),
  CATASTO_API_KEY: z.string().min(1).optional(),
  // V2 Step 4: perizia long-context (riusa ANTHROPIC_API_KEY). Default opus.
  PERIZIA_MODEL: z.string().min(1).optional(),
  // Fase 3: zone intelligence (Perplexity). Senza key il layer è no-op.
  PERPLEXITY_API_KEY: z.string().min(1).optional(),
  PERPLEXITY_MODEL: z.string().min(1).optional(),
  PERPLEXITY_BASE_URL: z.string().url().optional(),
  ZONE_OMI_DEVIATION_THRESHOLD: z.coerce.number().positive().optional(),
  // Fase 4: correzione LLM vincolata. Doppio gate: ANTHROPIC_API_KEY + CORRECTION_ENABLED.
  CORRECTION_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  CORRECTION_MODEL: z.string().min(1).optional(),
  CORRECTION_CLAMP_MAX_PCT: z.coerce.number().min(0).max(0.2).optional(),
  CORRECTION_REQUIRE_ZONE_INTEL: z.enum(['true', 'false']).optional(),
  // V2 Step 5: fonti ufficiali comparabili (seam estensibile via COMPS_SOURCE).
  // Le API reali sono validate in deploy (come Apify/Catasto).
  COMPS_SOURCE: z.string().min(1).default('apify'),
  IDEALISTA_DATA_BASE_URL: z.string().url().optional(),
  IDEALISTA_DATA_API_KEY: z.string().min(1).optional(),
  IMMOBILIARE_INSIGHTS_BASE_URL: z.string().url().optional(),
  IMMOBILIARE_INSIGHTS_API_KEY: z.string().min(1).optional(),
  // Gate delle affordance UI (upload/analizza). Default off finché non configurato.
  DOCUMENTI_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  source: NodeJS.ProcessEnv,
  scope: string,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configurazione env (${scope}) non valida:\n${issues}`);
  }
  return result.data;
}

let cachedPublic: PublicEnv | null = null;
let cachedServer: ServerEnv | null = null;

export function getPublicEnv(): PublicEnv {
  cachedPublic ??= parseOrThrow(publicSchema, process.env, 'public');
  return cachedPublic;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() non deve essere chiamato lato client.');
  }
  cachedServer ??= parseOrThrow(serverSchema, process.env, 'server');
  return cachedServer;
}
