import fs from 'node:fs';
const server = fs.readFileSync('server.ts', 'utf8');
const middleware = fs.readFileSync('src/server/middleware/requestDiagnostics.ts', 'utf8');
if (!/app\.use\(diagnostics\.correlation\)/.test(server)) throw new Error('HTTP correlation middleware is not mounted');
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
  ['Canonical P95 SLO policy import', /import sloPolicy from ['"]\.\.\/\.\.\/ops\/slo\.json['"]/,],
  ['Canonical P95 SLO threshold', /p95 > API_P95_SLO_MS \? 1 : 0/],
  ['Prometheus metrics', /observabilityPrometheus/],
  ['OTLP trace exporter', /OTLPTraceExporter/],
];
for (const [label, re] of checks) {
  const source = label === 'OpenTelemetry SDK provider' || label === 'W3C traceparent extraction' || label === 'Canonical P95 SLO policy import' || label === 'Canonical P95 SLO threshold' || label === 'Prometheus metrics' || label === 'Gemini token usage' || label === 'OTLP trace exporter' ? obs : label === 'Express HTTP spans' ? middleware : label === 'Firestore transaction spans' ? db : ai;
  if (!re.test(source)) throw new Error(`Observability boundary failed: ${label}`);
}
console.log('Observability boundary: PASS');
