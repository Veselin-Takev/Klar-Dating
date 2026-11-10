import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReleaseApprovalFailures } from './release-go-evidence.mjs';
import { validateCanaryState } from './validate-canary-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseCheck = 'node "$(dirname "${BASH_SOURCE[0]}")/check-production-release-approval.mjs"';
const checkoutCheck = 'node "$(dirname "${BASH_SOURCE[0]}")/check-production-checkout-identity.mjs"';
const scripts = ['scripts/deploy-prod.sh', 'scripts/promote-prod.sh'];

test('canary and promotion both enforce the exact-SHA GO check before any GCP invocation', () => {
  for (const path of scripts) {
    const text = readFileSync(resolve(root, path), 'utf8');
    const gate = text.indexOf(releaseCheck);
    const sourceGate = text.indexOf(checkoutCheck);
    const gcloud = text.indexOf('command -v gcloud');
    const firstCloudRun = text.indexOf('gcloud run ');
    assert.ok(gate >= 0, path + ' missing release approval check');
    assert.ok(sourceGate > gate, path + ' must bind actual source to approved SHA after evidence GO');
    assert.ok(gcloud > sourceGate, path + ' must verify source identity before even locating gcloud');
    assert.ok(firstCloudRun > gate, path + ' must check GO before Cloud Run commands');
    assert.ok(text.includes('set -euo pipefail'), path + ' must fail fast');
  }
});

test('canary refuses foreign or mutable images before release approval or gcloud', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-canary-image-gate-'));
  const invoked = join(tmp, 'any-external-command-called');
  try {
    for (const name of ['node', 'gcloud']) {
      writeFileSync(join(tmp, name),
        '#!/bin/sh\nprintf "called\\n" >> "$KLAR_IMAGE_GATE_SPY"\nexit 0\n',
        { mode: 0o755 });
    }
    const digest = 'a'.repeat(64);
    const approved = 'ghcr.io/example/klar-app';
    const base = {
      ...process.env,
      PATH: tmp + ':' + (process.env.PATH ?? ''),
      KLAR_IMAGE_GATE_SPY: invoked,
      KLAR_PROJECT_ID: 'demo-klar',
      KLAR_REGION: 'europe-west3',
      KLAR_SERVICE: 'klar-test-only',
      KLAR_CONFIRM_PRODUCTION: 'deploy',
      KLAR_IMAGE_REPOSITORY: approved,
    };
    const rejected = [
      { image: 'ghcr.io/outsider/klar-app@sha256:' + digest,
        expected: /outside the approved image repository/ },
      { image: 'ghcr.io/example/foreign-app@sha256:' + digest,
        expected: /immutable GHCR klar-app digest/ },
      { image: 'docker.io/example/klar-app@sha256:' + digest,
        expected: /immutable GHCR klar-app digest/ },
      { image: approved + ':latest',
        expected: /immutable GHCR klar-app digest/ },
    ];
    for (const scenario of rejected) {
      const result = spawnSync('bash', ['scripts/deploy-prod.sh'], {
        cwd: root,
        env: { ...base, KLAR_IMAGE: scenario.image },
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.equal(result.status, 2,
        'a foreign/mutable image must never proceed: ' + result.stderr);
      assert.match(result.stderr, scenario.expected);
      assert.equal(existsSync(invoked), false,
        'reject image before both release-check Node and Cloud Run CLI');
    }
    const missingRepository = spawnSync('bash', ['scripts/deploy-prod.sh'], {
      cwd: root,
      env: { ...base, KLAR_IMAGE_REPOSITORY: '', KLAR_IMAGE: approved + '@sha256:' + digest },
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(missingRepository.status, 1,
      'a missing image repository must be denied');
    assert.equal(existsSync(invoked), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('canary traffic updates only the verified immutable revision, never a mutable tag', () => {
  const deploy = readFileSync(resolve(root, 'scripts/deploy-prod.sh'), 'utf8');
  assert.ok(deploy.includes('--to-revisions "${candidate_revision}=10"'),
    'canary must use the explicit revision name for its 10% traffic');
  assert.doesNotMatch(deploy, /--to-tags candidate=(?:10|100)/,
    'mutable tag traffic assignment is not an acceptable release target');
  assert.doesNotMatch(deploy, /echo "gcloud run services update-traffic/,
    'do not print an unguarded 100% promotion command');
  assert.match(deploy, /candidate_image.*gcloud run revisions describe/s,
    'the deployed candidate image must be inspected before traffic change');
  assert.ok(deploy.includes('before "${candidate_revision}" "${candidate_state}"'),
    'validate exact candidate tag before health checks');
  assert.ok(deploy.includes('after "${candidate_revision}" "${post_state}"'),
    'validate exact traffic percentage after rollout');
});

test('tagged candidate must match an exact 0% revision before the health probes', () => {
  const revision = 'klar-service-candidate-12345';
  const url = 'https://candidate---klar-service-abcdef.a.run.app';
  const fresh = { status: { traffic: [
    { revisionName: 'klar-service-stable', percent: 100 },
    { revisionName: revision, tag: 'candidate', url },
  ] } };
  assert.equal(validateCanaryState(fresh, 'before', revision), url);
  assert.throws(() => validateCanaryState(fresh, 'before', 'klar-service-other'),
    /Candidate tag does not uniquely target/);
  assert.throws(() => validateCanaryState({
    status: { traffic: [
      { revisionName: 'klar-service-stable', percent: 90 },
      { revisionName: revision, tag: 'candidate', percent: 10, url },
    ] },
  }, 'before', revision), /zero traffic/);
  assert.throws(() => validateCanaryState({ status: { traffic: [
    { revisionName: revision, tag: 'candidate', url },
    { revisionName: revision, tag: 'candidate', url },
  ] } }, 'before', revision), /uniquely target/);
  assert.throws(() => validateCanaryState({ status: { traffic: [
    { revisionName: revision, tag: 'candidate', url: 'https://attacker.example/' },
  ] } }, 'before', revision), /direct HTTPS Cloud Run/);
});

test('post-shift check requires exactly 10% candidate and 100% total traffic', () => {
  const revision = 'klar-service-candidate-12345';
  const url = 'https://candidate---klar-service-abcdef.a.run.app';
  const state = { status: { traffic: [
    { revisionName: revision, tag: 'candidate', percent: 10, url },
    { revisionName: 'klar-service-stable', percent: 90 },
  ] } };
  assert.equal(validateCanaryState(state, 'after', revision), url);
  assert.throws(() => validateCanaryState({ status: { traffic: [
    { revisionName: revision, tag: 'candidate', percent: 90, url },
    { revisionName: 'klar-service-stable', percent: 10 },
  ] } }, 'after', revision), /exactly 10/);
  assert.throws(() => validateCanaryState({ status: { traffic: [
    { revisionName: revision, tag: 'candidate', percent: 10, url },
    { revisionName: 'klar-service-stable', percent: 50 },
  ] } }, 'after', revision), /total 100/);
  assert.throws(() => validateCanaryState({ status: { traffic: [
    { revisionName: revision, tag: 'candidate', percent: '10', url },
    { revisionName: 'klar-service-stable', percent: 90 },
  ] } }, 'after', revision), /Invalid candidate traffic percentage/);
});

test('a synthetic NO-GO decision cannot be overridden by a protected approval flag alone', () => {
  const failures = collectReleaseApprovalFailures({
    manifest: {
      releaseEvidence: { status: 'VERIFIED' },
      releaseGovernance: {
        decision: 'NO-GO',
        productionApproved: false,
        blockers: [],
        integrationEvidence: { overallDecision: 'GO' },
      },
    },
    checklist: '- [x] Synthetic checked item',
    env: {
      KLAR_PRODUCTION_RELEASE_APPROVED: 'true',
      GITHUB_SHA: 'a'.repeat(40),
    },
  });
  assert.ok(failures.some(reason => reason.includes('not explicitly GO and approved')),
    'a true environment flag must never override a NO-GO manifest');
});

test('rejected GO preflight blocks explicit canary and promotion before any GCP command', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-release-no-go-'));
  const spyPath = join(tmp, 'gcloud-called');
  const nodeSpyPath = join(tmp, 'node-approval-check-called');
  try {
    writeFileSync(join(tmp, 'gcloud'),
      '#!/bin/sh\nprintf "called\\n" >> "$KLAR_GCLOUD_SPY_FILE"\nexit 0\n', { mode: 0o755 });
    // An explicit denying Node preflight makes the test stable even after a
    // legitimate future GO replaces the repository's current NO-GO manifest.
    writeFileSync(join(tmp, 'node'),
      '#!/bin/sh\necho called >> "$KLAR_NODE_SPY_FILE"\necho "mock-release-approval-denied" >&2\nexit 42\n',
      { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: tmp + ':' + (process.env.PATH ?? ''),
      KLAR_GCLOUD_SPY_FILE: spyPath,
      KLAR_NODE_SPY_FILE: nodeSpyPath,
      KLAR_PROJECT_ID: 'demo-klar',
      KLAR_REGION: 'europe-west3',
      KLAR_SERVICE: 'klar-staging-test-only',
      KLAR_IMAGE: 'ghcr.io/example/klar-app@sha256:' + 'a'.repeat(64),
      KLAR_IMAGE_REPOSITORY: 'ghcr.io/example/klar-app',
      KLAR_CONFIRM_PRODUCTION: 'deploy',
      KLAR_CONFIRM_PROMOTION: 'promote',
      KLAR_PROMOTE_REVISION: 'candidate-test',
      KLAR_PROMOTE_IMAGE: 'ghcr.io/example/klar-app@sha256:' + 'a'.repeat(64),
      KLAR_PROMOTION_EVIDENCE: '/nonexistent/observation.json',
      KLAR_EVIDENCE_ENVIRONMENT: 'production',
      KLAR_EVIDENCE_NOT_BEFORE: '2026-11-01T00:00:00.000Z',
      KLAR_EVIDENCE_NOT_AFTER: '2026-11-08T00:00:00.000Z',
      KLAR_EVIDENCE_HOSTS: 'example.com',
      KLAR_PRODUCTION_RELEASE_APPROVED: 'true',
      GITHUB_SHA: 'a'.repeat(40),
    };
    for (const path of scripts) {
      const result = spawnSync('bash', [path], {
        cwd: root, env, encoding: 'utf8', timeout: 20000,
      });
      assert.notEqual(result.status, 0, path + ' must reject a failing GO preflight');
      assert.match(result.stderr, /mock-release-approval-denied/,
        path + ' must invoke and honor the release evidence validator');
      assert.equal(existsSync(nodeSpyPath), true, path + ' must execute the preflight');
      assert.equal(existsSync(spyPath), false, path + ' must never invoke gcloud');
      rmSync(nodeSpyPath, { force: true });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('Git checkout identity gate accepts only exact clean tracked source', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-checkout-identity-'));
  try {
    writeFileSync(join(tmp, 'git'), `#!/bin/sh
if [ "$1" = "rev-parse" ]; then
  if [ "$KLAR_FAKE_GIT_MODE" = "unavailable" ]; then exit 1; fi
  if [ "$KLAR_FAKE_GIT_MODE" = "wrong-sha" ]; then printf '%040d\\n' 0; else printf '%s\\n' "$KLAR_FAKE_SHA"; fi
  exit 0
fi
if [ "$1" = "diff" ]; then
  if [ "$KLAR_FAKE_GIT_MODE" = "dirty" ]; then exit 1; fi
  if [ "$KLAR_FAKE_GIT_MODE" = "unavailable" ]; then exit 128; fi
  exit 0
fi
exit 2
`, { mode: 0o755 });
    const sha = 'a'.repeat(40);
    const base = {
      ...process.env,
      PATH: tmp + ':' + (process.env.PATH ?? ''),
      GITHUB_SHA: sha,
      KLAR_FAKE_SHA: sha,
    };
    for (const [mode, expected] of [
      ['clean', 0],
      ['wrong-sha', 2],
      ['dirty', 2],
      ['unavailable', 2],
    ]) {
      const result = spawnSync(process.execPath, ['scripts/check-production-checkout-identity.mjs'], {
        cwd: root,
        env: { ...base, KLAR_FAKE_GIT_MODE: mode },
        encoding: 'utf8', timeout: 15000,
      });
      assert.equal(result.status, expected, 'unexpected checkout verdict for ' + mode
        + ': ' + result.stderr);
    }
    const missing = spawnSync(process.execPath, ['scripts/check-production-checkout-identity.mjs'], {
      cwd: root,
      env: { ...base, GITHUB_SHA: '' },
      encoding: 'utf8', timeout: 15000,
    });
    assert.equal(missing.status, 2, 'empty declared SHA must always fail');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('promotion validator cannot be replaced by changing the caller working directory', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-promotion-path-'));
  const nodeLog = join(tmp, 'node-args.txt');
  const cloudLog = join(tmp, 'gcloud-calls.txt');
  const trustedValidator = resolve(root, 'scripts/validate-promotion-evidence.mjs');
  try {
    writeFileSync(join(tmp, 'node'), `#!/bin/sh
printf '%s\\n' "$1" >> "$KLAR_NODE_ARGS_LOG"
case "$1" in
  *check-production-release-approval.mjs|*check-production-checkout-identity.mjs) exit 0 ;;
  *validate-promotion-evidence.mjs) echo "mock-evidence-denied" >&2; exit 42 ;;
  *) exit 44 ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(tmp, 'gcloud'),
      '#!/bin/sh\necho called >> "$KLAR_GCLOUD_CALLS"\nexit 0\n', { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: tmp + ':' + (process.env.PATH ?? ''),
      KLAR_NODE_ARGS_LOG: nodeLog,
      KLAR_GCLOUD_CALLS: cloudLog,
      KLAR_CONFIRM_PROMOTION: 'promote',
      KLAR_PROJECT_ID: 'demo-klar',
      KLAR_REGION: 'europe-west3',
      KLAR_SERVICE: 'klar-test',
      KLAR_PROMOTE_REVISION: 'candidate-test',
      KLAR_PROMOTE_IMAGE: 'ghcr.io/example/klar-app@sha256:' + 'a'.repeat(64),
      KLAR_IMAGE_REPOSITORY: 'ghcr.io/example/klar-app',
      KLAR_PROMOTION_EVIDENCE: join(tmp, 'untrusted-evidence.json'),
      KLAR_EVIDENCE_ENVIRONMENT: 'production',
      KLAR_EVIDENCE_NOT_BEFORE: '2026-11-01T00:00:00.000Z',
      KLAR_EVIDENCE_NOT_AFTER: '2026-11-08T00:00:00.000Z',
      KLAR_EVIDENCE_HOSTS: 'example.com',
      GITHUB_SHA: 'a'.repeat(40),
    };
    const result = spawnSync('bash', [resolve(root, 'scripts/promote-prod.sh')], {
      cwd: tmp, env, encoding: 'utf8', timeout: 20000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mock-evidence-denied/);
    const invokedScripts = readFileSync(nodeLog, 'utf8').trim().split('\n');
    assert.equal(invokedScripts.length, 3, 'GO, checkout and promotion evidence validators required');
    assert.equal(invokedScripts[2], trustedValidator,
      'promotion validator must come from checked-out release script directory, not caller CWD');
    assert.equal(existsSync(cloudLog), false, 'no Cloud Run command before rejecting evidence');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('emergency rollback is not blocked by the deploy/promotion GO preflight', () => {
  const rollback = readFileSync(resolve(root, 'scripts/rollback-cloud-run.sh'), 'utf8');
  assert.equal(rollback.includes('check-production-release-approval.mjs'), false,
    'do not make emergency recovery dependent on a new release GO');
});
