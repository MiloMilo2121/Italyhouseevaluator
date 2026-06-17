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
