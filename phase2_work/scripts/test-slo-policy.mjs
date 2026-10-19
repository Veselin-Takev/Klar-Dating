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
const source = readFileSync(path.join(projectRoot, 'src/server/observability.ts'), 'utf8');
assert.match(source, /import sloPolicy from ['"]\.\.\/\.\.\/ops\/slo\.json['"]/);
assert.match(source, /p95 > API_P95_SLO_MS \? 1 : 0/);
assert.doesNotMatch(source, /p95 > 1500/);
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

console.log('PASS: canonical API P95 threshold, 299/300/301 ms boundary and no legacy 1500ms hardcode');
