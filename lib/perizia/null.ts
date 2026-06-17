import type { DocumentAttachment, PeriziaInput, PeriziaSections, PeriziaWriter } from './types';

/**
 * Degrado: senza ANTHROPIC_API_KEY la perizia non viene generata (null), come
 * il NullNarrator. La pagina perizia mostra comunque i numeri del motore.
 */
export class NullPeriziaWriter implements PeriziaWriter {
  async write(_input: PeriziaInput, _attachments?: DocumentAttachment[]): Promise<PeriziaSections | null> {
    return null;
  }
}
