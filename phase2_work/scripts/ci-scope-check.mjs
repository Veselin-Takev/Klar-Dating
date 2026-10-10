import { test } from 'node:test';
import assert from 'node:assert/strict';
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
