import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requiresFullValidation } from './ci-scope.mjs';

test('only explicit narrative files avoid application validation on PRs', () => {
  assert.equal(requiresFullValidation(['phase2_work/docs/PROJECT_STATUS.md'], 'pull_request'), false);
});
test('unknown, code, rules, workflow, release and mixed changes require full validation', () => {
  for (const file of ['phase2_work/src/App.tsx', 'phase2_work/firestore.rules', '.github/workflows/ci.yml', 'phase2_work/docs/PRODUCTION_READINESS.md', 'phase2_work/bun.lock', 'README.md']) {
    assert.equal(requiresFullValidation(['phase2_work/docs/PROJECT_STATUS.md', file], 'pull_request'), true);
  }
});
test('empty change sets and all main pushes require full validation', () => {
  assert.equal(requiresFullValidation([], 'pull_request'), true);
  assert.equal(requiresFullValidation(['phase2_work/docs/PROJECT_STATUS.md'], 'push'), true);
});

test('security evidence and bootstrap updates always request full CI validation', () => {
  for (const file of [
    'phase2_work/scripts/audit-production-controls.ts',
    'phase2_work/scripts/report-path.mjs',
    'phase2_work/scripts/production-audit-evidence-check.test.mjs',
    'phase2_work/scripts/check-codespaces-bootstrap.mjs',
    'phase2_work/scripts/local-preflight.mjs',
    '.devcontainer/devcontainer.json',
  ]) {
    assert.equal(requiresFullValidation([file], 'pull_request'), true, `${file} must not skip full CI`);
  }
});

test('scope diff subprocess is bounded and errors fall back to full validation', () => {
  const source = readFileSync(new URL('./ci-scope.mjs', import.meta.url), 'utf8');
  assert.match(source, /execFileSync\('git',[\s\S]*?timeout:\s*15_000,\s*maxBuffer:\s*1024 \* 1024/);
  assert.match(source, /catch\s*\{[\s\S]*?full validation required/);
});
