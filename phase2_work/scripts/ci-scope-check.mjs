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

test('renamed or deleted code paths cannot qualify as narrative-only', () => {
  const from = 'phase2_work/src/App.tsx';
  const to = 'phase2_work/docs/PROJECT_STATUS.md';
  assert.equal(requiresFullValidation([from, to], 'pull_request'), true);
  assert.equal(requiresFullValidation([from], 'pull_request'), true);
  // Git diff --no-renames emits both endpoints for a rename, including a removed source.
  const source = readFileSync(new URL('./ci-scope.mjs', import.meta.url), 'utf8');
  assert.match(source, /'--no-renames'/);
});

test('dependency caches are restored only after cheap validation gates', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const codespaces = workflow.indexOf('      - name: Codespaces bootstrap regression');
  const evidence = workflow.indexOf('      - name: Production audit evidence regressions');
  const locks = workflow.indexOf('      - name: Dependency lock preflight');
  const cache = workflow.indexOf('      - name: Restore dependency downloads');
  const install = workflow.indexOf('      - name: Install dependencies');
  assert.ok(codespaces >= 0 && codespaces < evidence && evidence < locks && locks < cache && cache < install);
  assert.doesNotMatch(workflow, /^\s*cache:\s*npm\s*$/m);
  assert.match(workflow, /~\/\.npm/);
  assert.match(workflow, /hashFiles\('phase2_work\/bun\.lock', 'phase2_work\/functions\/package-lock\.json'\)/);
});
