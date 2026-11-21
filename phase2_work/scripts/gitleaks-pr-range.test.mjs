import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEventCommitRange, inspectGitCommitRange } from './prepare-gitleaks-range.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = join(repoRoot, '.github/workflows/enterprise-compliance-audit-gate.yml');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), 'klar-gitleaks-range-'));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.name', 'Klar Gitleaks Range Test');
  git(cwd, 'config', 'user.email', 'gitleaks-range-test@example.invalid');
  writeFileSync(join(cwd, 'base.txt'), 'base\n');
  git(cwd, 'add', 'base.txt');
  git(cwd, 'commit', '-q', '-m', 'base');
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') };
}

test('PR base..head Gitleaks range includes commits 31, 32 and final HEAD', () => {
  const { cwd, base } = initRepo();
  try {
    const expected = [];
    for (let i = 1; i <= 32; i += 1) {
      writeFileSync(join(cwd, 'history.txt'), 'commit ' + i + '\n');
      git(cwd, 'add', 'history.txt');
      git(cwd, 'commit', '-q', '-m', 'PR commit ' + i);
      expected.push(git(cwd, 'rev-parse', 'HEAD'));
    }

    const head = expected.at(-1);
    const result = resolveEventCommitRange({
      GITHUB_EVENT_NAME: 'pull_request',
      PR_BASE_SHA: base,
      PR_HEAD_SHA: head,
    }, { cwd });

    assert.equal(result.commitCount, 32);
    assert.equal(result.headSha, head);
    assert.equal(result.commits.at(-1), head);
    assert.ok(result.commits.includes(expected[30]), '31st PR commit must be in range');
    assert.ok(result.commits.includes(expected[31]), '32nd/final PR commit must be in range');
    assert.deepEqual(new Set(result.commits), new Set(expected));
    assert.match(result.logOpts, /--full-history/);
    assert.match(result.logOpts, /--diff-merges=separate/);
    assert.equal(result.range, base + '..' + head);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('range preflight includes all commits from a merge graph without counting merge-parent patches twice', () => {
  const { cwd, base } = initRepo();
  try {
    git(cwd, 'switch', '-c', 'feature');
    writeFileSync(join(cwd, 'feature.txt'), 'feature\n');
    git(cwd, 'add', 'feature.txt');
    git(cwd, 'commit', '-q', '-m', 'feature commit');
    const featureCommit = git(cwd, 'rev-parse', 'HEAD');

    git(cwd, 'switch', 'main');
    writeFileSync(join(cwd, 'main.txt'), 'main\n');
    git(cwd, 'add', 'main.txt');
    git(cwd, 'commit', '-q', '-m', 'main commit');
    const mainCommit = git(cwd, 'rev-parse', 'HEAD');

    git(cwd, 'merge', '--no-ff', '-m', 'merge feature', 'feature');
    const head = git(cwd, 'rev-parse', 'HEAD');
    const result = inspectGitCommitRange(base, head, { cwd });
    assert.equal(result.commitCount, 3);
    assert.ok(result.commits.includes(featureCommit));
    assert.ok(result.commits.includes(mainCommit));
    assert.ok(result.commits.includes(head));
    assert.match(result.logOpts, /--diff-merges=separate/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('workflow uses full checkout and explicit PR base/head SHAs, not Gitleaks Action pagination', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/);
  assert.match(workflow, /PR_BASE_SHA:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha/);
  assert.match(workflow, /PR_HEAD_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /node phase2_work\/scripts\/prepare-gitleaks-range\.mjs/);
  assert.match(workflow, /GITLEAKS_LOG_OPTS:\s*\$\{\{\s*steps\.gitleaks_range\.outputs\.log_opts\s*\}\}/);
  assert.match(workflow, /gitleaks detect/);
  assert.match(workflow, /--redact/);
  assert.match(workflow, /--exit-code=2/);
  assert.match(workflow, /--report-format=sarif/);
  assert.match(workflow, /--report-path=results\.sarif/);
  assert.match(workflow, /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/);
  assert.doesNotMatch(workflow, /gitleaks\/gitleaks-action@/);
  assert.doesNotMatch(workflow, /pulls\/\{pull_number\}\/commits/);
  assert.ok(existsSync(join(repoRoot, '.gitleaksignore')), 'root .gitleaksignore must remain available');
});

test('unresolvable or invalid PR ranges fail closed', () => {
  assert.throws(() => inspectGitCommitRange('not-a-sha', '0'.repeat(40)), /full 40-character Git SHA/);
  assert.throws(() => resolveEventCommitRange({ GITHUB_EVENT_NAME: 'pull_request' }), /full 40-character Git SHA/);
});
