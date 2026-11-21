import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function requireSha(value, label) {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
    throw new Error(String(label) + ' is missing or is not a full 40-character Git SHA');
  }
  return value.toLowerCase();
}

export function inspectGitCommitRange(baseSha, headSha, options = {}) {
  const cwd = options.cwd || process.cwd();
  const base = requireSha(baseSha, 'base SHA');
  const head = requireSha(headSha, 'head SHA');
  const range = base + '..' + head;

  try {
    git(['cat-file', '-e', base + '^{commit}'], cwd);
    git(['cat-file', '-e', head + '^{commit}'], cwd);
  } catch {
    throw new Error('Gitleaks range cannot be resolved: base=' + base + ', head=' + head);
  }

  try {
    git(['merge-base', '--is-ancestor', base, head], cwd);
  } catch {
    throw new Error('Gitleaks base ' + base + ' is not an ancestor of head ' + head);
  }

  const reachable = git(['rev-list', '--reverse', range], cwd)
    .split(/\r?\n/)
    .filter(Boolean);
  // --diff-merges=separate intentionally emits one patch per merge parent in the scan.
  // Enumerate unique commit objects without patches here to compare the object set to rev-list.
  const gitleaksCommitList = git(
    ['log', '--format=%H', '--no-patch', '--full-history', range],
    cwd,
  )
    .split(/\r?\n/)
    .filter(Boolean);

  if (reachable.length === 0) {
    throw new Error('Gitleaks range resolved to zero commits: ' + range);
  }

  const scannedSet = new Set(gitleaksCommitList);
  const omitted = reachable.filter((sha) => !scannedSet.has(sha));
  if (omitted.length > 0 || scannedSet.size !== reachable.length) {
    throw new Error(
      'Gitleaks git-log range does not cover every reachable commit (' + omitted.length + ' omitted): ' + range,
    );
  }

  if (!reachable.includes(head)) {
    throw new Error('Gitleaks range does not include final HEAD ' + head);
  }

  return {
    baseSha: base,
    headSha: head,
    range,
    commitCount: reachable.length,
    commits: reachable,
    logOpts: '--full-history --diff-merges=separate ' + range,
  };
}

export function resolveEventCommitRange(env, options = {}) {
  const cwd = options.cwd || process.cwd();
  const eventName = env.GITHUB_EVENT_NAME;
  let baseSha;
  let headSha;

  if (eventName === 'pull_request') {
    baseSha = env.PR_BASE_SHA;
    headSha = env.PR_HEAD_SHA;
  } else if (eventName === 'push') {
    baseSha = env.PUSH_BEFORE_SHA;
    headSha = env.PUSH_AFTER_SHA;
  } else if (eventName === 'workflow_dispatch') {
    headSha = env.WORKFLOW_SHA;
    const head = requireSha(headSha, 'workflow dispatch SHA');
    try {
      baseSha = git(['rev-parse', '--verify', head + '^'], cwd);
    } catch {
      throw new Error('Cannot determine parent commit for workflow dispatch HEAD ' + head);
    }
  } else {
    throw new Error('Unsupported Gitleaks event type: ' + (eventName || '(missing)'));
  }

  const range = inspectGitCommitRange(baseSha, headSha, { cwd });
  const checkedOutHead = git(['rev-parse', '--verify', 'HEAD^{commit}'], cwd);
  if (checkedOutHead !== range.headSha) {
    throw new Error(
      'Checkout HEAD ' + checkedOutHead + ' does not match requested Gitleaks head ' + range.headSha,
    );
  }
  return range;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = resolveEventCommitRange(process.env);
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error('GITHUB_OUTPUT is not available; refusing to run an unrecorded Gitleaks range');
    }
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        'base_sha=' + result.baseSha,
        'head_sha=' + result.headSha,
        'commit_count=' + result.commitCount,
        'log_opts=' + result.logOpts,
      ].join('\n') + '\n',
      'utf8',
    );
    console.log(
      'Prepared complete Gitleaks range ' + result.range + ': ' + result.commitCount + ' commit(s), final HEAD ' + result.headSha,
    );
  } catch (error) {
    console.error('Gitleaks range preflight failed closed: ' + error.message);
    process.exitCode = 1;
  }
}
