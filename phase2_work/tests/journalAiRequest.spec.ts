import { afterEach, describe, expect, it, vi } from 'vitest';
import { JournalRequestError, journalErrorMessage, requestJournalAI } from '../src/lib/journalAiRequest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('AI journal response boundary', () => {
  it('returns validated JSON objects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: 'Erlebnis' }), { status: 200 })));
    await expect(requestJournalAI('/api/generate-reflection-from-emojis', { emojis: ['😊'] })).resolves.toEqual({ notes: 'Erlebnis' });
  });
  it('preserves an explicit budget exhausted outcome without success fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(requestJournalAI('/api/dating-journal-analysis', { notes: 'abc' })).rejects.toMatchObject({ kind: 'limit' });
    expect(journalErrorMessage(new JournalRequestError('limit'))).toContain('Kontingent');
  });
  it('rejects malformed success and non-429 failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    await expect(requestJournalAI('/api/dating-journal-analysis', {})).rejects.toMatchObject({ kind: 'invalid' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(requestJournalAI('/api/dating-journal-analysis', {})).rejects.toMatchObject({ kind: 'service' });
  });
  it('releases the timeout and returns a safe timeout outcome', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = requestJournalAI('/api/dating-journal-analysis', {}, 50);
    const failure = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(50);
    await failure;
  });
});
