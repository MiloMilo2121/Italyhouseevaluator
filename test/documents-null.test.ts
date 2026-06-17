import { describe, it, expect } from 'vitest';
import {
  MockCatastoProvider,
  NullCatastoProvider,
  NullReconciler,
  NullTranscriber,
  NullVisionExtractor,
} from '@/lib/documents/null';
import { makeCatasto } from './fixtures/documents.fixture';

const file = { data: '', mime: 'application/pdf' };

describe('adapter Null (degrado)', () => {
  it('ritornano null su tutte le estrazioni', async () => {
    const v = new NullVisionExtractor();
    expect(await v.extractApe(file)).toBeNull();
    expect(await v.extractPlanimetria({ data: '', mime: 'image/png' })).toBeNull();
    expect(await new NullTranscriber().transcribe({ data: '', mime: 'audio/mpeg' })).toBeNull();
    expect(await new NullCatastoProvider().lookup({ indirizzo: null, comune: null })).toBeNull();
    expect(
      await new NullReconciler().reconcile({
        declared: {
          propertyType: 'appartamento',
          superficieMq: 85,
          condizioni: 'nuova',
          classeEnergetica: null,
          piano: null,
          pianiEdificio: null,
          ascensore: false,
        },
        ape: null,
        planimetria: null,
        catasto: null,
        voiceNotes: [],
      }),
    ).toBeNull();
  });

  it('MockCatastoProvider ritorna la fixture', async () => {
    const c = makeCatasto();
    expect(await new MockCatastoProvider(c).lookup({ indirizzo: null, comune: null })).toEqual(c);
  });
});
