import { context, trace, SpanStatusCode, ROOT_CONTEXT, type Context, type Span, type SpanContext } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor, SimpleSpanProcessor, type ReadableSpan, type SpanExporter, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import sloPolicy from '../../ops/slo.json';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'klar-api';
const API_P95_SLO_MS = (() => {
  const target = sloPolicy.objectives.find(objective => objective.name === 'api-latency-p95-ms')?.target;
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
    throw new Error('Invalid API P95 SLO configuration');
  }
  return target;
})();
const MAX_SPANS = 5000;
const MINUTE_MS = 60_000;

type MinuteBucket = { minute: number; requests: number; errors: number; latencyMs: number[]; geminiRequests: number; geminiInputTokens: number; geminiOutputTokens: number; geminiTotalTokens: number };
const spans: ReadableSpan[] = [];
const minuteBuckets = new Map<number, MinuteBucket>();
const firestoreTransactions = new Map<string, { requests: number; errors: number }>();

function bucketFor(timestamp = Date.now()): MinuteBucket {
  const minute = Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
  let bucket = minuteBuckets.get(minute);
  if (!bucket) {
    bucket = { minute, requests: 0, errors: 0, latencyMs: [], geminiRequests: 0, geminiInputTokens: 0, geminiOutputTokens: 0, geminiTotalTokens: 0 };
    minuteBuckets.set(minute, bucket);
  }
  return bucket;
}

function trim() {
  while (spans.length > MAX_SPANS) spans.shift();
  const cutoff = Date.now() - 15 * 60_000;
  for (const [minute] of minuteBuckets) if (minute < cutoff) minuteBuckets.delete(minute);
  for (const bucket of minuteBuckets.values()) if (bucket.latencyMs.length > 2000) bucket.latencyMs.splice(0, bucket.latencyMs.length - 2000);
}

class InProcessObservabilityExporter implements SpanExporter {
  export(readableSpans: ReadableSpan[], resultCallback: (result: { code: number; error?: Error }) => void): void {
    for (const span of readableSpans) {
      spans.push(span);
      const start = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
      const end = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
      const durationMs = Math.max(0, end - start);
      const name = span.name;
      if (name.startsWith('HTTP ')) {
        const bucket = bucketFor(start);
        bucket.requests += 1;
        bucket.latencyMs.push(durationMs);
        if (span.status.code === SpanStatusCode.ERROR) bucket.errors += 1;
      }
      if (name === 'gemini.generateContent') {
        const bucket = bucketFor(start);
        bucket.geminiRequests += 1;
        bucket.geminiInputTokens += Number(span.attributes['gen_ai.usage.input_tokens'] ?? 0) || 0;
        bucket.geminiOutputTokens += Number(span.attributes['gen_ai.usage.output_tokens'] ?? 0) || 0;
        bucket.geminiTotalTokens += Number(span.attributes['gen_ai.usage.total_tokens'] ?? 0) || 0;
      }
    }
    trim();
    resultCallback({ code: 0 });
  }
  shutdown(): Promise<void> { return Promise.resolve(); }
  forceFlush(): Promise<void> { return Promise.resolve(); }
}

const exporter = new InProcessObservabilityExporter();
const spanProcessors: SpanProcessor[] = [new SimpleSpanProcessor(exporter)];
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (otlpEndpoint) {
  spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpEndpoint })));
}
const provider = new NodeTracerProvider({ spanProcessors });
provider.register();
const tracer = trace.getTracer(SERVICE_NAME, '1.0.0');

export function extractTraceContext(traceparent: string | undefined): Context {
  if (typeof traceparent !== 'string') return ROOT_CONTEXT;
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(traceparent.trim());
  const traceId = match?.[1];
  const spanId = match?.[2];
  const traceFlags = match?.[3];
  if (!traceId || !spanId || !traceFlags || /^0{32}$/.test(traceId) || /^0{16}$/.test(spanId)) return ROOT_CONTEXT;
  const spanContext: SpanContext = { traceId: traceId.toLowerCase(), spanId: spanId.toLowerCase(), traceFlags: parseInt(traceFlags, 16), isRemote: true };
  return trace.setSpanContext(ROOT_CONTEXT, spanContext);
}

export function startHttpSpan(method: string, route: string, parent: Context): Span {
  return tracer.startSpan(`HTTP ${method}`, { attributes: { 'service.name': SERVICE_NAME, 'http.request.method': method, 'http.route': route } }, parent);
}

export function runInSpan<T>(span: Span, fn: () => Promise<T>): Promise<T> {
  return context.with(trace.setSpan(context.active(), span), fn);
}

export async function observeFirestoreTransaction<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const metric = firestoreTransactions.get(name) ?? { requests: 0, errors: 0 };
  metric.requests += 1;
  firestoreTransactions.set(name, metric);
  const span = tracer.startSpan('firestore.transaction', { attributes: { 'db.system': 'firestore', 'db.operation.name': name } });
  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    const failedMetric = firestoreTransactions.get(name) ?? { requests: 0, errors: 0 };
    failedMetric.errors += 1;
    firestoreTransactions.set(name, failedMetric);
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

export async function observeGeminiCall<T>(endpoint: string, model: string, fn: () => Promise<T>, usageFromResult: (result: T) => { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined): Promise<T> {
  const span = tracer.startSpan('gemini.generateContent', { attributes: { 'gen_ai.system': 'Google Gemini', 'gen_ai.request.model': model, 'klar.endpoint': endpoint } });
  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    const usage = usageFromResult(result) ?? {};
    if (usage.inputTokens !== undefined) span.setAttribute('gen_ai.usage.input_tokens', usage.inputTokens);
    if (usage.outputTokens !== undefined) span.setAttribute('gen_ai.usage.output_tokens', usage.outputTokens);
    if (usage.totalTokens !== undefined) span.setAttribute('gen_ai.usage.total_tokens', usage.totalTokens);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

export function observabilityPrometheus(): string {
  const now = Date.now();
  const recent = [...minuteBuckets.values()].filter(bucket => bucket.minute >= now - 15 * MINUTE_MS);
  const latencies = recent.flatMap(bucket => bucket.latencyMs);
  const gemini = recent.reduce((acc, bucket) => ({
    requests: acc.requests + bucket.geminiRequests,
    input: acc.input + bucket.geminiInputTokens,
    output: acc.output + bucket.geminiOutputTokens,
    total: acc.total + bucket.geminiTotalTokens,
  }), { requests: 0, input: 0, output: 0, total: 0 });
  const latest = bucketFor(now);
  const p95 = percentile(latencies, 0.95);
  return [
    '# HELP klar_http_request_duration_ms HTTP server request latency.', '# TYPE klar_http_request_duration_ms gauge',
    `klar_http_request_duration_ms{quantile="0.95"} ${p95}`,
    `# HELP klar_http_p95_slo_breach P95 latency over the ${API_P95_SLO_MS}ms configured SLO target.`, '# TYPE klar_http_p95_slo_breach gauge', `klar_http_p95_slo_breach ${p95 > API_P95_SLO_MS ? 1 : 0}`,
    '# HELP klar_gemini_requests_total Gemini requests in the rolling observability window.', '# TYPE klar_gemini_requests_total gauge', `klar_gemini_requests_total ${gemini.requests}`,
    '# HELP klar_gemini_input_tokens_total Gemini input tokens in the rolling observability window.', '# TYPE klar_gemini_input_tokens_total gauge', `klar_gemini_input_tokens_total ${gemini.input}`,
    '# HELP klar_gemini_output_tokens_total Gemini output tokens in the rolling observability window.', '# TYPE klar_gemini_output_tokens_total gauge', `klar_gemini_output_tokens_total ${gemini.output}`,
    '# HELP klar_gemini_total_tokens_total Gemini total tokens in the rolling observability window.', '# TYPE klar_gemini_total_tokens_total gauge', `klar_gemini_total_tokens_total ${gemini.total}`,
    '# HELP klar_gemini_minute_input_tokens Current UTC minute Gemini input tokens.', '# TYPE klar_gemini_minute_input_tokens gauge', `klar_gemini_minute_input_tokens ${latest.geminiInputTokens}`,
    '# HELP klar_gemini_minute_output_tokens Current UTC minute Gemini output tokens.', '# TYPE klar_gemini_minute_output_tokens gauge', `klar_gemini_minute_output_tokens ${latest.geminiOutputTokens}`,
    '# HELP klar_gemini_minute_total_tokens Current UTC minute Gemini total tokens.', '# TYPE klar_gemini_minute_total_tokens gauge', `klar_gemini_minute_total_tokens ${latest.geminiTotalTokens}`,
    '# HELP klar_firestore_transactions_total Firestore transactions started in the process lifetime.', '# TYPE klar_firestore_transactions_total gauge',
    ...[...firestoreTransactions.entries()].map(([operation, metric]) => `klar_firestore_transactions_total{operation="${operation.replaceAll('"', '')}"} ${metric.requests}`),
    '# HELP klar_firestore_transaction_errors_total Firestore transaction failures in the process lifetime.', '# TYPE klar_firestore_transaction_errors_total gauge',
    ...[...firestoreTransactions.entries()].map(([operation, metric]) => `klar_firestore_transaction_errors_total{operation="${operation.replaceAll('"', '')}"} ${metric.errors}`),
  ].join('\n') + '\n';
}

export function currentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
}
