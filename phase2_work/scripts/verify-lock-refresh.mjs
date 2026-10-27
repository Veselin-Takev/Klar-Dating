import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const allowed = ['package.json', 'bun.lock', 'phase2_work/package.json', 'phase2_work/bun.lock'];
const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
assert.ok(changed.length > 0 && changed.every(file => allowed.includes(file)), 'Unexpected generated change scope');
for (const file of ['package.json', 'phase2_work/package.json']) {
  const original = JSON.parse(execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' }));
  const candidate = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(candidate, original, 'Transitive qs refresh must not change manifest dependencies');
}
for (const file of ['bun.lock', 'phase2_work/bun.lock']) {
  const lock = fs.readFileSync(file, 'utf8');
  const versions = [...new Set([...lock.matchAll(/\["qs@([^"]+)"/g)].map(match => match[1]))].sort();
  assert.deepEqual(versions, ['6.16.2', '6.17.0'], 'Both reviewed qs lines required; no older or unreviewed version allowed');
}
const sourceHead = process.env.SOURCE_HEAD;
assert.match(sourceHead ?? '', /^[a-f0-9]{40}$/, 'Missing exact PR source revision');
const evidence = {
  schemaVersion: 1, purpose: 'review candidate; not approved or deployed',
  sourceHead, checkoutCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  target: { package: 'qs', versions: ['6.16.2', '6.17.0'] },
  node: process.version, bun: execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim(),
  hashes: Object.fromEntries(allowed.map(file => [file, {
    before: crypto.createHash('sha256').update(execFileSync('git', ['show', `HEAD:${file}`])).digest('hex'),
    candidate: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  }])),
};
assert.equal(evidence.node, 'v22.23.3');
assert.equal(evidence.bun, '1.4.4');
fs.writeFileSync('lock-refresh-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log('Candidate scope and hashes verified; independent frozen install, scan and full CI still required.');
