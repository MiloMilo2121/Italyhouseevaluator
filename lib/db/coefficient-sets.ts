import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCoefficientSet } from '@/lib/valuation/coefficients';
import type { CoefficientSet } from '@/lib/valuation/types';

/**
 * Carica il coefficient_set attivo dal DB e lo valida/tipizza. È un read core
 * (la riga è seedata da 0008): un fallimento qui equivale a DB non disponibile.
 */
export async function loadActiveCoefficientSet(client: SupabaseClient): Promise<CoefficientSet> {
  const { data, error } = await client
    .from('coefficient_sets')
    .select('*')
    .eq('active', true)
    .single();
  if (error) throw new Error(`Caricamento coefficient_set attivo fallito: ${error.message}`);
  return parseCoefficientSet(data);
}
