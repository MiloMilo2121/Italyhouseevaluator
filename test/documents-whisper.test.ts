import { describe, it, expect, vi } from 'vitest';
import { OpenAiTranscriber, audioFilenameFromMime } from '@/lib/documents/openai-whisper';

describe('audioFilenameFromMime', () => {
  it('mappa correttamente i vari formati audio', () => {
    expect(audioFilenameFromMime('audio/mpeg')).toBe('nota-vocale.mp3');
    expect(audioFilenameFromMime('audio/mp4')).toBe('nota-vocale.m4a');
    expect(audioFilenameFromMime('audio/x-m4a')).toBe('nota-vocale.m4a');
    expect(audioFilenameFromMime('audio/wav')).toBe('nota-vocale.wav');
    expect(audioFilenameFromMime('audio/webm')).toBe('nota-vocale.webm');
    expect(audioFilenameFromMime('audio/unknown')).toBe('nota-vocale.mp3'); // default fallback
  });
});

describe('OpenAiTranscriber', () => {
  it('invia multipart con filename provvisto di estensione audio a OpenAI Whisper', async () => {
    let capturedBody: FormData | null = null;
    let capturedHeaders: HeadersInit | undefined = undefined;

    const fakeFetch: typeof fetch = async (_url, init) => {
      capturedBody = init?.body as FormData;
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ text: 'Ristrutturato nel 2022' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const transcriber = new OpenAiTranscriber({
      apiKey: 'test-key',
      fetchImpl: fakeFetch,
    });

    const file = {
      data: Buffer.from('fake-audio-bytes').toString('base64'),
      mime: 'audio/m4a',
    };

    const res = await transcriber.transcribe(file);

    expect(res).toEqual({
      transcript: 'Ristrutturato nel 2022',
      sintesi: null,
      puntiChiave: [],
    });

    expect(capturedBody).not.toBeNull();
    const uploadedFile = capturedBody!.get('file') as File;
    expect(uploadedFile).toBeDefined();
    expect(uploadedFile.name).toBe('nota-vocale.m4a');
  });

  it('lancia errore esplicito se Whisper restituisce stato non-ok', async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response('Invalid file format', { status: 400 });
    };

    const transcriber = new OpenAiTranscriber({
      apiKey: 'test-key',
      fetchImpl: fakeFetch,
    });

    const file = {
      data: Buffer.from('bad').toString('base64'),
      mime: 'audio/wav',
    };

    await expect(transcriber.transcribe(file)).rejects.toThrow('OpenAI transcription 400');
  });
});
