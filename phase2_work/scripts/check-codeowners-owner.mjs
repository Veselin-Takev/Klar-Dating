import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const owners = readFileSync(new URL('../../CODEOWNERS', import.meta.url), 'utf8');
const parsed = owners.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
assert.ok(parsed.length >= 10, 'Missing file ownership inventory');
assert.ok(parsed.every(line => /^\S+\s+@Veselin-Takev$/.test(line)), 'Owners must be verified repository owner only');
assert.ok(parsed.some(line => line.startsWith('/CODEOWNERS ')), 'CODEOWNERS must own itself');
for (const path of ['/phase2_work/', '/phase2_work/src/server/', '/phase2_work/firestore.rules',
  '/phase2_work/storage.rules', '/phase2_work/scripts/', '/phase2_work/docs/PRODUCTION_RUNBOOK.md']) {
  assert.ok(parsed.some(line => line.startsWith(path + ' ')), 'Missing protected path: ' + path);
}
assert.doesNotMatch(owners, /@klar\//, 'Unverified organization teams forbidden');
console.log('PASS: verified individual CODEOWNERS fallback and critical path coverage');
