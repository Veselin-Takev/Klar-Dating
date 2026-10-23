#!/usr/bin/env node
/** Read-only host preparation check. Does not run Docker builds, tests, GitHub actions or grant GO. */
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_COMMIT = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
export const PINNED_NODE = 'v22.23.3';
export const PINNED_BUN = '1.4.2';
export const TARGET_GIT_TREE = '05f22f0ca387ae37573b1f81e85ead901dce3da9';
// A digest reference binds image bytes; this does NOT authenticate who approved it.
const DIGEST_REF = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const REQUIRED_TOOLS = Object.freeze([
  ['git', ['--version']],
  ['bash', ['--version']],
  ['sha256sum', ['--version']],
  ['docker', ['--version']],
  ['docker', ['info', '--format', '{{.ServerVersion}}']],
]);

function commandProbe(executable, args) {
  try {
    const out = execFileSync(executable, args, {
      encoding: 'utf8', timeout: 6_000, maxBuffer: 4_194_304,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DOCKER_CLI_HINTS: 'false', GIT_OPTIONAL_LOCKS: '0' },
    });
    return { ok: true, output: out.trim() };
  } catch (e) {
    // Avoid embedding stderr/stdout or environmental secrets into the report.
    return { ok: false, reason: e.code === 'ENOENT' ? 'executable missing' : 'unavailable, timed out or returned nonzero' };
  }
}

function directoryProbe(path) {
  const dir = resolve(path);
  if (!isAbsolute(path)) return { ok: false, state: 'results path must be absolute' };
  try {
    const st = lstatSync(dir);
    if (!st.isDirectory() || st.isSymbolicLink()) return { ok: false, state: 'not a real directory' };
    if ((st.mode & 0o077) !== 0) return { ok: false, state: 'directory not owner-only (mode must be 0700)' };
    if (readdirSync(dir).length) return { ok: false, state: 'pre-existing files; never overwrite old evidence' };
    return { ok: true, state: 'empty private directory' };
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: true, state: 'absent (fresh output may be created by authorized operator)' };
    return { ok: false, state: 'could not inspect results directory' };
  }
}

/** Verify the actual, clean source checkout, not merely a supplied target SHA.
 * Never checkout/fetch/reset/change the repository. Reject redirects and subdirectories.
 */
export function inspectCheckout(checkoutDir, probe = commandProbe) {
  if (typeof checkoutDir !== 'string' || !isAbsolute(checkoutDir)) {
    return { ok: false, state: 'source checkout absolute path not supplied' };
  }
  const dir = resolve(checkoutDir);
  try {
    const st = lstatSync(dir);
    if (!st.isDirectory() || st.isSymbolicLink() || realpathSync(dir) !== dir) {
      return { ok: false, state: 'checkout path not an unredirected directory' };
    }
  } catch {
    return { ok: false, state: 'checkout path could not be inspected' };
  }
  // All probes are read-only git commands; no shell evaluation or git remote access.
  const git = (...args) => probe('git', [
    '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
    '-C', dir, ...args,
  ]);
  const root = git('rev-parse', '--show-toplevel');
  const head = git('rev-parse', '--verify', 'HEAD');
  const tree = git('rev-parse', '--verify', 'HEAD^{tree}');
  const dirty = git('status', '--porcelain=v1', '--untracked-files=all');
  // Git status intentionally trusts index assume-unchanged and skip-worktree flags.
  // A tampered worktree can therefore appear clean; reject either flag fail-closed.
  // -z avoids ambiguous line escaping for tracked filenames containing whitespace.
  const indexFlags = git('ls-files', '--cached', '-v', '-z');
  if (![root, head, tree, dirty, indexFlags].every(p => p.ok)) {
    return { ok: false, state: 'checkout git inspection failed' };
  }
  const entries = indexFlags.output.split('\0').filter(Boolean);
  const hiddenFlags = entries.filter(entry => {
    // Git ls-files -v prefixes lowercase for assume-unchanged and S for skip-worktree.
    // Other unexpected entry types are not qualified immutable release checkouts.
    const flag = entry.charAt(0);
    return entry.charAt(1) !== ' ' || flag !== 'H';
  });
  return {
    ok: root.output === dir,
    state: root.output === dir ? 'git checkout inspected' : 'path is not the repository root',
    head: head.output,
    tree: tree.output,
    clean: dirty.output === '' && hiddenFlags.length === 0 && entries.length > 0,
    index_flags_safe: hiddenFlags.length === 0 && entries.length > 0,
  };
}

/** Pure policy evaluation. `probes` are observations, not self-issued approvals. */
export function evaluateReadiness({commit, node, bun, image, authorizationReference, probes, results, checkout}) {
  const findings = [];
  const fail = (code, reason) => findings.push({ code, reason });
  if (commit !== TARGET_COMMIT) fail('COMMIT_MISMATCH', 'requested target must equal the immutable PR #119 SHA');
  if (node !== PINNED_NODE) fail('NODE_MISMATCH', 'Node.js v22.23.3 required');
  if (bun !== PINNED_BUN) fail('BUN_MISMATCH', 'Bun 1.4.2 required');
  if (!DIGEST_REF.test(image || '')) fail('IMAGE_UNPINNED', 'approved audit image must be supplied as full sha256 digest reference');
  if (typeof authorizationReference !== 'string' || authorizationReference.trim().length < 10) {
    fail('AUTHORIZATION_REFERENCE_MISSING', 'provide a nonsecret written authorization reference before requesting execution');
  }
  for (let i = 0; i < REQUIRED_TOOLS.length; i++) {
    const item = probes?.[i];
    if (!item?.ok || !item.output) {
      fail(i === 4 ? 'DOCKER_DAEMON_UNAVAILABLE' : `TOOL_${REQUIRED_TOOLS[i][0].toUpperCase()}_${i}_UNAVAILABLE`,
        `${REQUIRED_TOOLS[i][0]} ${REQUIRED_TOOLS[i][1].join(' ')} failed`);
    }
  }
  if (!results?.ok) fail('RESULTS_UNSAFE', results?.state || 'results directory not inspected');
  if (!checkout?.ok) fail('CHECKOUT_UNAVAILABLE', checkout?.state || 'actual source checkout not inspected');
  if (checkout?.ok && checkout.head !== TARGET_COMMIT) fail('CHECKOUT_COMMIT_MISMATCH', 'actual git HEAD is not target PR #119 commit');
  if (checkout?.ok && checkout.tree !== TARGET_GIT_TREE) fail('CHECKOUT_TREE_MISMATCH', 'actual git tree is not target PR #119 tree');
  if (checkout?.ok && checkout.index_flags_safe !== true) fail('CHECKOUT_INDEX_FLAGS_UNSAFE', 'tracked index flags hide files or index entries are not ordinary cached files');
  if (checkout?.ok && checkout.clean !== true) fail('CHECKOUT_DIRTY', 'source checkout has modifications, hidden index flags or untracked files');
  return {
    target_commit: TARGET_COMMIT,
    checked_commit: commit,
    required_node: PINNED_NODE,
    observed_node: node || null,
    required_bun: PINNED_BUN,
    observed_bun: bun || null,
    image_digest_declared: DIGEST_REF.test(image || ''),
    authorization_reference_declared: typeof authorizationReference === 'string' && authorizationReference.trim().length >= 10,
    results_directory: results?.state || 'not inspected',
    observed_checkout_commit: checkout?.head || null,
    observed_checkout_tree: checkout?.tree || null,
    checkout_clean: checkout?.clean === true,
    checkout_index_flags_safe: checkout?.index_flags_safe === true,
    technical_preflight_pass: findings.length === 0,
    release_decision: 'NO-GO',
    execution_authorized: false,
    approvals_identity_verified: false,
    warnings: [
      'This is only a read-only local environment preflight. It cannot authenticate authorization or image provenance.',
      'Do not run a paid host audit until Security and Release Owner independently approve the immutable scope and runner.',
      'Even a passing preflight is not a mandatory gate, a GitHub check, or production release approval.',
      'Network access, Docker image provenance, dependency/scanner pins, host signature, and real test execution are not verified here.',
    ],
    findings,
  };
}

/** Read-only collection; can be dependency-injected for deterministic testing. */
export function inspectHost({
  commit = TARGET_COMMIT,
  image = process.env.KLAR_APPROVED_AUDIT_IMAGE,
  authorizationReference = process.env.KLAR_AUDIT_AUTHORIZATION_REF,
  resultsDir = '/srv/klar-audit/results',
  checkoutDir = process.env.KLAR_AUDIT_CHECKOUT_DIR,
  probe = commandProbe,
  inspectDirectory = directoryProbe,
  inspectGitCheckout = inspectCheckout,
} = {}) {
  const node = probe('node', ['--version']);
  const bun = probe('bun', ['--version']);
  const probes = REQUIRED_TOOLS.map(([exe, args]) => probe(exe, args));
  const results = inspectDirectory(resultsDir);
  const checkout = inspectGitCheckout(checkoutDir, probe);
  return evaluateReadiness({
    commit,
    node: node.ok ? node.output : null,
    bun: bun.ok ? bun.output : null,
    image,
    authorizationReference,
    probes,
    results,
    checkout,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = new Map();
  let valid = args.length % 2 === 0;
  if (valid) {
    for (let i = 0; i < args.length; i += 2) {
      if (!['--results', '--checkout'].includes(args[i]) || flags.has(args[i]) || !isAbsolute(args[i + 1])) {
        valid = false;
        break;
      }
      flags.set(args[i], args[i + 1]);
    }
  }
  if (!valid) {
    console.error('Usage: node preflight-authorized-host-audit.mjs [--checkout /absolute/immutable/source] [--results /absolute/path]');
    process.exitCode = 2;
  } else {
    const report = inspectHost({
      resultsDir: flags.get('--results') || '/srv/klar-audit/results',
      checkoutDir: flags.get('--checkout') || process.env.KLAR_AUDIT_CHECKOUT_DIR,
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.technical_preflight_pass ? 0 : 1;
  }
}
