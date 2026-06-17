import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Config per i test d'integrazione (DB Supabase/PostGIS reale). Esclusi dal run
 * di default. Richiedono OMI_TEST_SUPABASE_URL + OMI_TEST_SUPABASE_SERVICE_KEY
 * e le migrazioni applicate (incl. 0009/0010). Avvio: `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
