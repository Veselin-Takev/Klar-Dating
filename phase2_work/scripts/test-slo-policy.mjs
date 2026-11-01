import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';


const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(readFileSync(path.join(projectRoot, 'ops/slo.json'), 'utf8'));
const objective = policy.objectives.filter(item => item.name === 'api-latency-p95-ms');
assert.equal(objective.length, 1, 'Exactly one canonical API P95 SLO is required');
const target = objective[0].target;
assert.ok(Number.isFinite(target) && target > 0, 'API P95 target must be positive and finite');

// P1 #71: the configured indicator must match the exact Prometheus time
// series actually emitted by observabilityPrometheus(), not a phantom metric.
const indicator = objective[0].indicator;
assert.equal(indicator, 'klar_http_request_duration_ms{quantile="0.95"}',
  'The API P95 SLO must reference the published quantile gauge');

const source = readFileSync(path.join(projectRoot, 'src/server/observability.ts'), 'utf8');
assert.match(source, /import sloPolicy from ['"]\.\.\/\.\.\/ops\/slo\.json['"]/);
assert.match(source, /p95 > API_P95_SLO_MS \? 1 : 0/);
assert.ok(source.includes('`' + indicator + ' ${p95}`'),
  'The SLO gauge and the configured indicator disagree');
assert.ok(source.includes('# TYPE klar_http_request_duration_ms gauge'),
  'The P95 Prometheus metric type does not match its policy');
assert.doesNotMatch(source, /klar_http_latency_ms/,
  'Obsolete latency metric must not be used in the emitter');

assert.doesNotMatch(source, /p95 > 1500/);
// Exercise configuration validation without bootstrapping the tracing SDK.
const initialization = source.match(/const API_P95_SLO_MS = ([\s\S]*?);\r?\nconst MAX_SPANS/);
assert(initialization, 'Validated P95 initialization is missing');
function configuredTarget(objectives) {
  return runInNewContext(initialization[1], { sloPolicy: { objectives } }, { timeout: 1500 });
}
assert.equal(configuredTarget(policy.objectives), target);
assert.throws(() => configuredTarget([]), /Invalid API P95 SLO configuration/);
for (const invalid of [undefined, null, '300', 0, -1, NaN, Infinity]) {
  assert.throws(() => configuredTarget([{ name: 'api-latency-p95-ms', target: invalid }]),
    /Invalid API P95 SLO configuration/);
}
// Exercise the exact metric expression, not a duplicated numeric comparison.
const valueExpression = source.match(/`klar_http_p95_slo_breach \${([^}]+)}`/);
assert(valueExpression, 'P95 Prometheus emission is missing');
assert.equal(valueExpression[1], 'p95 > API_P95_SLO_MS ? 1 : 0', 'P95 emitter must use canonical SLO');
for (const [p95, expected] of [[299, 0], [300, 0], [301, 1], [1500, 1]]) {
  assert.equal(runInNewContext(valueExpression[1], { p95, API_P95_SLO_MS: target }, { timeout: 1500 }),
    expected, `P95 ${p95}ms produced unexpected breach status`);
}
// Its legacy validator must change too, otherwise check:enterprise rejects a correct fix.
const gate = readFileSync(path.join(projectRoot, 'scripts/check-observability.mjs'), 'utf8');
assert.match(gate, /Canonical P95 SLO threshold/);
assert.match(gate, /p95 > API_P95_SLO_MS/);
assert.doesNotMatch(gate, /1500ms SLO|p95 > 1500/);


console.log('PASS: canonical emitted API P95 gauge and 299/300/301 ms threshold agree with ops/slo.json');

