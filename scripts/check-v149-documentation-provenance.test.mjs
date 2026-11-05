// @node --test
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const checker = fileURLToPath(new URL('./check-v149-documentation-provenance.mjs', import.meta.url));
function run(cwd, ...args) {
  const p = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 });
  assert.equal(p.status, 0, (p.stderr || '') + (p.error?.message || ''));
  return p.stdout.trim();
}
function audit(dir, initial, evidenceBase, evidenceBlob) {
  const json = join(dir, 'audit', 'provenance.json');
  const p = spawnSync(process.execPath, [
    checker, '--repo=' + dir, '--report=' + json,
    '--v149-ref=' + initial, '--r2-ref=' + initial,
    '--doc-baseline-ref=' + evidenceBase,
    '--expected-evidence-sha=' + evidenceBlob,
  ], { cwd: dir, encoding: 'utf8', timeout: 30000 });
  return { exit: p.status, report: JSON.parse(readFileSync(json, 'utf8')), stdout: p.stdout };
}
test('pins v149/R2 paths and preserves the exact P0 evidence blob on the dedicated branch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-doc-integrity-'));
  try {
    run(dir, 'init', '-b', 'main');
    run(dir, 'config', 'user.name', 'Klar CI');
    run(dir, 'config', 'user.email', 'ci@example.invalid');
    mkdirSync(join(dir, 'phase2_work', 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'phase2_work', 'scripts', 'local.mjs'), 'export const ready = true;\n');
    writeFileSync(join(dir, 'README.md'), 'v149 base\n');
    run(dir, 'add', '-A'); run(dir, 'commit', '-m', 'v149 base');
    const initial = run(dir, 'rev-parse', 'HEAD');
    run(dir, 'checkout', '-b', 'docs/ci-governance-audit-2026-10-23');
    mkdirSync(join(dir, 'phase2_work', 'docs'), { recursive: true });
    const path = 'phase2_work/docs/P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md';
    writeFileSync(join(dir, path), '# frozen evidence\n');
    writeFileSync(join(dir, 'phase2_work', 'docs', 'governance.md'), '# governance\n');
    run(dir, 'add', '-A'); run(dir, 'commit', '-m', 'add documentation evidence');
    const docBaseline = run(dir, 'rev-parse', 'HEAD');
    const evidenceBlob = run(dir, 'rev-parse', 'HEAD:' + path);
    run(dir, 'checkout', 'main');
    const ok = audit(dir, initial, docBaseline, evidenceBlob);
    assert.equal(ok.exit, 0, ok.stdout);
    assert.equal(ok.report.verdict, 'PASS_COMMITTED_REACHABLE_PATHS_ONLY');
    assert.equal(ok.report.missingV149.length, 0);
    assert.equal(ok.report.missingDocumentation.length, 0);
    assert.equal(ok.report.evidencePaths[0].sha, evidenceBlob);
    assert.equal(ok.report.counts.documentationOnlyPaths, 2);

    run(dir, 'checkout', 'docs/ci-governance-audit-2026-10-23');
    writeFileSync(join(dir, path), '# changed evidence\n');
    run(dir, 'add', '-A'); run(dir, 'commit', '-m', 'tamper evidence');
    run(dir, 'checkout', 'main');
    const changed = audit(dir, initial, docBaseline, evidenceBlob);
    assert.equal(changed.exit, 1);
    assert.ok(changed.report.failures.includes('EVIDENCE_BLOB_CHANGED_OR_MISSING'));

    run(dir, 'rm', 'phase2_work/scripts/local.mjs');
    run(dir, 'commit', '-m', 'remove v149 script from main');
    const missing = audit(dir, initial, docBaseline, evidenceBlob);
    assert.equal(missing.exit, 1);
    assert.ok(missing.report.failures.includes('V149_PATHS_MISSING_FROM_MAIN'));
    assert.ok(missing.report.failures.includes('R2_PATHS_MISSING_FROM_MAIN'));
    assert.ok(missing.report.missingV149.includes('phase2_work/scripts/local.mjs'));
    assert.equal(missing.report.counts.documentationBranch >= 3, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
