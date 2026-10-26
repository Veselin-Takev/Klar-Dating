// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBoundedResponse } from '../src/server/boundedResponse';
import { translateText } from '../src/server/translationService';

function streamed(chunks: Uint8Array[], headers?: HeadersInit) {
  let reads = 0; const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { const chunk = chunks[reads++]; if (chunk) controller.enqueue(chunk); else controller.close(); },
    cancel,
  }, { highWaterMark: 0 });
  return { response: new Response(body, { headers }), cancel, reads: () => reads };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('bounded decoded response consumption', () => {
  it.each([3, 4, 5])('preserves exact bytes with a %i-byte cap', async limit => {
    const source = streamed([new Uint8Array([0, 255]), new Uint8Array([13])]);
    expect(await readBoundedResponse(source.response, limit)).toEqual(new Uint8Array([0, 255, 13]));
    expect(source.cancel).not.toHaveBeenCalled(); expect(source.response.body!.locked).toBe(false);
  });
  it('accepts empty and bodyless responses', async () => {
    expect(await readBoundedResponse(new Response(null), 8)).toHaveLength(0);
    expect(await readBoundedResponse(streamed([]).response, 8)).toHaveLength(0);
  });
  it('cancels announced oversize without requesting a chunk', async () => {
    const source = streamed([new Uint8Array(9)], { 'content-length': '9' });
    await expect(readBoundedResponse(source.response, 8)).rejects.toThrow('upstream_response_too_large');
    expect(source.reads()).toBe(0); expect(source.cancel).toHaveBeenCalledOnce();
  });
  it.each([undefined, '1', 'invalid', '-1'])('counts bytes despite length hint %s and stops reading immediately', async length => {
    const source = streamed([new Uint8Array(4), new Uint8Array(5), new Uint8Array(100)],
      length === undefined ? undefined : { 'content-length': length });
    await expect(readBoundedResponse(source.response, 8, 'bounded_failure')).rejects.toThrow('bounded_failure');
    expect(source.reads()).toBe(2); expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.response.body!.locked).toBe(false);
  });
  it.each([0, -1, 0.5, NaN, Infinity])('rejects invalid limit %s before reading', async limit => {
    const source = streamed([new Uint8Array(1)]);
    await expect(readBoundedResponse(source.response, limit)).rejects.toThrow(RangeError);
    expect(source.reads()).toBe(0);
  });
  it('handles many tiny and empty chunks without retaining a chunk array', async () => {
    const source = streamed(Array.from({ length: 2000 }, (_, index) => new Uint8Array(index % 2)));
    expect(await readBoundedResponse(source.response, 1000)).toHaveLength(1000);
  });
  it('preserves a stream failure and releases the reader', async () => {
    const original = new Error('synthetic stream failure');
    const response = new Response(new ReadableStream({ start(controller) { controller.error(original); } }));
    await expect(readBoundedResponse(response, 8)).rejects.toBe(original);
    expect(response.body!.locked).toBe(false);
  });
  it('preserves size rejection when stream cancellation itself fails', async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(9)); },
      cancel() { throw new Error('synthetic cleanup failure'); },
    }, { highWaterMark: 0 }));
    await expect(readBoundedResponse(response, 8)).rejects.toThrow('upstream_response_too_large');
    expect(response.body!.locked).toBe(false);
  });
  it('caps actual decoded fetch bytes for gzip responses', async () => {
    const compressed = gzipSync('x'.repeat(1000));
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-encoding': 'gzip', 'content-length': compressed.byteLength }); res.end(compressed);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing local port');
      expect(compressed.byteLength).toBeLessThan(64);
      const response = await fetch(`http://127.0.0.1:${address.port}`);
      await expect(readBoundedResponse(response, 64)).rejects.toThrow('upstream_response_too_large');
    } finally {
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});

it('translation preserves split multibyte UTF-8 within the byte cap', async () => {
  vi.stubEnv('TRANSLATION_SERVICE_URL', 'http://translation.example.test');
  const encoded = new TextEncoder().encode(JSON.stringify({ textTranslated: 'Grüße 😀' }));
  const source = streamed([...encoded].map(byte => new Uint8Array([byte])));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
  expect(await translateText('hello', 'en', 'de')).toEqual({ textTranslated: 'Grüße 😀', sourceLang: 'en', targetLang: 'de', usedFallback: false });
});
it('translation cancels oversized data and uses its existing fallback', async () => {
  vi.stubEnv('TRANSLATION_SERVICE_URL', 'http://translation.example.test');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const source = streamed([new Uint8Array(64 * 1024), new Uint8Array(1), new Uint8Array(100)]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
  expect((await translateText('hello', 'en', 'de')).usedFallback).toBe(true);
  expect(source.reads()).toBe(2); expect(source.cancel).toHaveBeenCalledOnce();
});
it('all four active provider consumers use the shared streaming limit before parsing', () => {
  for (const [file, call] of [
    ['src/server/translationService.ts', 'readBoundedResponse(response, TRANSLATION_RESPONSE_MAX_BYTES'],
    ['src/server/accountDeletion.ts', 'readBoundedResponse(response, DIDIT_RESPONSE_MAX_BYTES'],
    ['src/server/verification/diditKyc.ts', 'readBoundedResponse(response, DIDIT_RESPONSE_MAX_BYTES'],
    ['server.ts', 'readBoundedResponse(imageRes, BILD_MAX_BYTES'],
  ]) {
    const source = readFileSync(file!, 'utf8'); expect(source).toContain(call);
    expect(source).not.toMatch(/(?:response|imageRes)\.(?:arrayBuffer|text|json)\(\)/);
  }
});
