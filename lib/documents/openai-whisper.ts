import type { DocumentFile, Transcriber, VoiceNoteExtraction } from './types';

/**
 * Trascrittore note vocali via OpenAI Whisper. Adapter leggero `fetch`+FormData
 * (come ApifyClient: niente SDK pesante, fetch iniettabile per i test). Gated su
 * OPENAI_API_KEY (factory). NB: lo shape esatto dell'endpoint/campi multipart va
 * confermato sull'ambiente deployato (seam configurabile).
 */

export const DEFAULT_WHISPER_MODEL = 'whisper-1';

type FetchImpl = typeof fetch;

export interface OpenAiTranscriberOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  fetchImpl?: FetchImpl;
}

export class OpenAiTranscriber implements Transcriber {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: OpenAiTranscriberOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
    this.model = opts.model ?? DEFAULT_WHISPER_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async transcribe(file: DocumentFile): Promise<VoiceNoteExtraction | null> {
    const bytes = Buffer.from(file.data, 'base64');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: file.mime }), 'nota-vocale');
    form.append('model', this.model);

    const res = await this.fetchImpl(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`OpenAI transcription ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { text?: unknown };
    if (typeof json.text !== 'string') return null;
    return { transcript: json.text, sintesi: null, puntiChiave: [] };
  }
}
