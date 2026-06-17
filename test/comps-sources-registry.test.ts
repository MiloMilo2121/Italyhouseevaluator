import { describe, it, expect } from 'vitest';
import { createCompsSourceAdapter, getCompsExtractor } from '@/lib/comps/sources/registry';

describe('createCompsSourceAdapter', () => {
  it('crea l’adapter quando la fonte è configurata', () => {
    expect(createCompsSourceAdapter('idealista_data', { IDEALISTA_DATA_API_KEY: 'k' })?.id).toBe('idealista_data');
    expect(createCompsSourceAdapter('immobiliare_insights', { IMMOBILIARE_INSIGHTS_API_KEY: 'k' })?.id).toBe(
      'immobiliare_insights',
    );
  });

  it('ritorna null se non configurata o sconosciuta', () => {
    expect(createCompsSourceAdapter('idealista_data', {})).toBeNull();
    expect(createCompsSourceAdapter('apify', { IDEALISTA_DATA_API_KEY: 'k' })).toBeNull();
    expect(createCompsSourceAdapter('boh', { IDEALISTA_DATA_API_KEY: 'k' })).toBeNull();
  });
});

describe('getCompsExtractor', () => {
  it('ritorna il mapping puro per le fonti note, null altrimenti', () => {
    expect(typeof getCompsExtractor('idealista_data')).toBe('function');
    expect(typeof getCompsExtractor('immobiliare_insights')).toBe('function');
    expect(getCompsExtractor('apify')).toBeNull();
  });
});
