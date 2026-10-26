// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

const sink = vi.hoisted(() => ({ spans: [] as ReadableSpan[] }));
// Keep the real SDK and BatchSpanProcessor. Replace only the network exporter;
// no external endpoint receives test data.
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {
    export(spans: ReadableSpan[], done: (result: { code: number }) => void) {
      sink.spans.push(...spans); done({ code: 0 });
    }
    shutdown() { return Promise.resolve(); }
  },
}));
let obs: typeof import('../src/server/observability');
let provider: { forceFlush(): Promise<void>; shutdown(): Promise<void> };
beforeAll(async () => {
  vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'http://127.0.0.1:1/test-only');
  obs = await import('../src/server/observability');
  provider = (trace.getTracerProvider() as unknown as {
    getDelegate(): typeof provider;
  }).getDelegate();
});
beforeEach(() => { sink.spans.length = 0; });
afterAll(async () => {
  await provider.shutdown(); trace.disable(); context.disable(); vi.unstubAllEnvs();
});
const canary = 'synthetic-private@example.test?token=SECRET-CANARY';
const failures: [string, () => unknown][] = [
  ['Error with sensitive message, stack and cause', () => {
    const error = new Error(canary, { cause: { response: canary } });
    error.name = canary; error.stack = canary; return error;
  }],
  ['provider response object', () => ({ message: canary, stack: canary, response: { data: canary } })],
  ['string rejection', () => canary],
  ['null rejection', () => null],
  ['undefined rejection', () => undefined],
  ['hostile getters', () => new Proxy({}, { get() { throw new Error('Must not inspect thrown value'); } })],
];
for (const kind of ['firestore', 'gemini'] as const) {
  describe(kind + ' exception export boundary', () => {
    it.each(failures)('minimizes %s and preserves the original rejection', async (_label, create) => {
      const original = create(); let caught: unknown = Symbol('not thrown');
      try {
        const fail = async () => { throw original; };
        if (kind === 'firestore') await obs.observeFirestoreTransaction('runTransaction', fail);
        else await obs.observeGeminiCall('translation', 'test-model', fail, () => undefined);
      } catch (error) { caught = error; }
      expect(Object.is(caught, original)).toBe(true);
      await provider.forceFlush();
      expect(sink.spans).toHaveLength(1);
      const span = sink.spans[0]!;
      expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('exception');
      expect(span.events[0]!.attributes).toEqual({
        'exception.type': kind === 'firestore' ? 'FirestoreOperationFailure' : 'GeminiOperationFailure',
      });
      expect(JSON.stringify({ events: span.events, status: span.status, attributes: span.attributes })).not.toContain(canary);
    });
  });
}
it('preserves successful results, token usage and transaction metrics', async () => {
  const result = { ok: true };
  expect(await obs.observeFirestoreTransaction('success-test', async () => result)).toBe(result);
  expect(await obs.observeGeminiCall('translation', 'test-model', async () => result,
    () => ({ inputTokens: 3, outputTokens: 2, totalTokens: 5 }))).toBe(result);
  await provider.forceFlush();
  expect(sink.spans).toHaveLength(2);
  for (const span of sink.spans) {
    expect(span.status).toEqual({ code: SpanStatusCode.OK }); expect(span.events).toEqual([]);
  }
  expect(sink.spans[1]!.attributes['gen_ai.usage.total_tokens']).toBe(5);
  expect(obs.observabilityPrometheus()).toContain('klar_firestore_transactions_total{operation="success-test"} 1');
  expect(obs.observabilityPrometheus()).toContain('klar_firestore_transaction_errors_total{operation="runTransaction"} 6');
});
