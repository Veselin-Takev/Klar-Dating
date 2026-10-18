import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
assert.equal(Number(299 > target), 0, '299ms should not breach configured SLO');
assert.equal(Number(300 > target), 0, '300ms should not breach configured SLO');
assert.equal(Number(301 > target), 1, '301ms must breach configured SLO');
console.log('PASS: canonical API P95 threshold, 299/300/301 ms boundary and no legacy 1500ms hardcode');
