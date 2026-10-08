import fs from 'node:fs';
const server = fs.readFileSync('server.ts', 'utf8');
const obs = fs.readFileSync('src/server/observability.ts', 'utf8');
const db = fs.readFileSync('src/server/durableStore.ts', 'utf8');
const ai = fs.readFileSync('src/server/aiBudget.ts', 'utf8');
const checks = [
  ['OpenTelemetry SDK provider', /NodeTracerProvider/],
  ['W3C traceparent extraction', /extractTraceContext/],
  ['Express HTTP spans', /startHttpSpan\(req\.method/],
  ['Firestore transaction spans', /observeFirestoreTransaction\('runTransaction'/],
  ['Gemini spans', /observeGeminiCall\(context\.endpoint/],
  ['Gemini token usage', /gen_ai\.usage\.total_tokens/],
  ['P95 1500ms SLO', /p95 > 1500/],
  ['Prometheus metrics', /observabilityPrometheus/],
  ['OTLP trace exporter', /OTLPTraceExporter/],
];
for (const [label, re] of checks) {
  const source = label === 'OpenTelemetry SDK provider' || label === 'W3C traceparent extraction' || label === 'P95 1500ms SLO' || label === 'Prometheus metrics' || label === 'Gemini token usage' || label === 'OTLP trace exporter' ? obs : label === 'Express HTTP spans' ? server : label === 'Firestore transaction spans' ? db : ai;
  if (!re.test(source)) throw new Error(`Observability boundary failed: ${label}`);
}
console.log('Observability boundary: PASS');
