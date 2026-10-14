import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = resolve('scripts/check-release-provenance.mjs');
const baseline = JSON.parse(readFileSync('RELEASE_MANIFEST.json', 'utf8'));
function run(manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'klar-provenance-'));
  try {
    writeFileSync(join(dir, 'RELEASE_MANIFEST.json'), JSON.stringify(manifest));
    return spawnSync(process.execPath, [validator], { cwd: dir, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts historical candidate only as NO-GO, not release proof', () => {
  const result = run(baseline);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /production remains NO-GO/);
});
test('rejects fabricated production approval', () => {
  const changed = structuredClone(baseline);
  changed.releaseGovernance.productionApproved = true;
  assert.notEqual(run(changed).status, 0);
});
test('rejects candidate marked verified without evidence', () => {
  const changed = structuredClone(baseline);
  changed.releaseGovernance.candidateVerified = true;
  assert.notEqual(run(changed).status, 0);
});
test('rejects bypass of pending evidence status', () => {
  const changed = structuredClone(baseline);
  changed.releaseEvidence.status = 'approved';
  assert.notEqual(run(changed).status, 0);
});
