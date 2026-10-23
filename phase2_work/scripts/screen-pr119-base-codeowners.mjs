#!/usr/bin/env node
/**
 * PR #119 read-only CODEOWNERS base/head drift screen.
 * This is not the GitHub CODEOWNERS engine and never attests live team access,
 * PR review requests, review decisions, branch protection or a production GO.
 * Limited to the simple anchored paths and the '*' default observed in the
 * exact reviewed source blobs. Unsupported patterns fail closed.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET = Object.freeze({
  repo: 'Veselin-Takev/Klar-Dating',
  pr: 119,
  baseBranch: 'test/p0-art17-owner-claim-cascade-regressions-2026-10-18',
  baseCommit: '9e886c67c97201602cd969fc57dfc9bf2d019c90',
  baseBlob: 'd3873fc1d9b44883ec6c9165125144a48683b5f2',
  headCommit: '7fdf29010c85f16a9b38e5c93186f32e92192f3a',
  headBlob: '3ecd92e7f5be76bf82adecb38705281fe5a92659',
});

export const CRITICAL_PATHS = Object.freeze({
  'phase2_work/src/server/authorization.ts': ['@klar/security'],
  'phase2_work/src/server/trustAndSafety.ts': ['@klar/security'],
  'phase2_work/src/server/routes/partnerReferrals.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/partnerReferralCore.ts': ['@klar/security'],
  'phase2_work/src/server/partnerReferralService.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/stripeService.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/cspRuntimePolicy.ts': ['@klar/security'],
  'phase2_work/server.ts': ['@klar/security'],
  'phase2_work/firestore.rules': ['@klar/security'],
  'phase2_work/storage.rules': ['@klar/security'],
  'phase2_work/scripts/configure-retention.sh': ['@klar/security'],
  'phase2_work/scripts/check-production-release-approval.mjs': ['@klar/security'],
  'phase2_work/RELEASE_MANIFEST.json': ['@klar/security'],
  'phase2_work/docs/DATA_RETENTION.md': ['@klar/security'],
  'phase2_work/GO_LIVE_CHECKLIST.md': ['@klar/security'],
  '.github/workflows/release.yml': ['@klar/security'],
  'CODEOWNERS': ['@klar/security'],
});

export function gitBlobSha(bytes) {
  assert(Buffer.isBuffer(bytes), 'Expected raw file bytes');
  return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`, 'utf8')).update(bytes).digest('hex');
}

export function parseSimpleCodeowners(source) {
  assert(typeof source === 'string', 'CODEOWNERS source must be text');
  const lines = source.split(/\r?\n/), rules = [], errors = [];
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (pattern !== '*' && (!pattern.startsWith('/') || /[*?\[\]\\!]/.test(pattern) || pattern.includes('..'))) {
      errors.push(`line ${i + 1}: unsupported pattern`);
      continue;
    }
    if (!owners.length || owners.some(o => !/^@[A-Za-z0-9][A-Za-z0-9-]*(?:\/[A-Za-z0-9][A-Za-z0-9-]*)?$/.test(o))) {
      errors.push(`line ${i + 1}: invalid or missing owner`);
      continue;
    }
    rules.push({ pattern, owners, line: i + 1 });
  }
  if (errors.length) return { rules: [], errors };
  return { rules, errors };
}

export function ownersForPath(rules, path) {
  assert(typeof path === 'string' && !path.startsWith('/') && !path.includes('..') && !path.includes('\\'), 'Invalid repository-relative path');
  let owners = [];
  for (const { pattern, owners: eligible } of rules) {
    if (pattern === '*') { owners = eligible; continue; }
    const trimmed = pattern.slice(1).replace(/\/$/, '');
    if (path === trimmed || path.startsWith(trimmed + '/')) {
      // All observed source patterns use exact files or directory prefixes.
      // For an exact file pattern, `path === trimmed` is the only relevant
      // match in the listed critical files. Directory-prefix matching is safe
      // here because no observed file-path has a nested descendant.
      owners = eligible;
    }
  }
  return owners;
}

export function analyzeBaseHead(base, head) {
  const baseParsed = parseSimpleCodeowners(base);
  const headParsed = parseSimpleCodeowners(head);
  const comparisons = [];
  if (baseParsed.errors.length || headParsed.errors.length) return {
    decision: 'NO-GO',
    technical_status: 'UNSUPPORTED_SOURCE_PATTERN',
    errors: [...baseParsed.errors.map(e => 'base: ' + e), ...headParsed.errors.map(e => 'head: ' + e)],
    path_comparisons: [],
    base_specialist_coverage: 0,
    head_specialist_coverage: 0,
    required_paths: Object.keys(CRITICAL_PATHS).length,
  };
  let baseCovered = 0, headCovered = 0;
  for (const [path, requiredOwners] of Object.entries(CRITICAL_PATHS)) {
    const baseOwners = ownersForPath(baseParsed.rules, path);
    const headOwners = ownersForPath(headParsed.rules, path);
    const missingBase = requiredOwners.filter(o => !baseOwners.includes(o));
    const missingHead = requiredOwners.filter(o => !headOwners.includes(o));
    if (!missingBase.length) baseCovered++;
    if (!missingHead.length) headCovered++;
    comparisons.push({ path, requiredOwners, baseOwners, headOwners, missingBase, missingHead });
  }
  return {
    decision: 'NO-GO',
    technical_status: baseCovered !== comparisons.length ? 'BASE_CODEOWNERS_SPECIALIST_GAP' : 'STATIC_BASE_PATHS_COVERED_ONLY',
    errors: [],
    required_paths: comparisons.length,
    base_specialist_coverage: baseCovered,
    head_specialist_coverage: headCovered,
    path_comparisons: comparisons,
  };
}

function readPinned(path, expectedBlob) {
  assert(typeof path === 'string' && path.startsWith('/'), 'Use an absolute path');
  const normalized = resolve(path);
  const stat = lstatSync(normalized);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size > 0 && stat.size < 3_000_000,
    'Not a safe regular CODEOWNERS source');
  const bytes = readFileSync(normalized);
  const actual = gitBlobSha(bytes);
  assert.equal(actual, expectedBlob, 'Pinned Git CODEOWNERS blob identity mismatch');
  return bytes.toString('utf8');
}

export function screenPinnedFiles(basePath, headPath) {
  const base = readPinned(basePath, TARGET.baseBlob);
  const head = readPinned(headPath, TARGET.headBlob);
  return {
    ...analyzeBaseHead(base, head),
    target: TARGET,
    base_blob_verified: true,
    head_blob_verified: true,
    source_checkout_authenticated_by_this_tool: false,
    parent_branch_protection_confirmed: false,
    team_existence_and_write_access_confirmed: false,
    independent_security_finance_reviews_confirmed: false,
    draft_pr_autoreview_expected: false,
    github_workflows_executed: 0,
    production_release_decision: 'NO-GO',
    release_gates_qualified: 0,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    assert(args.length === 4 && args[0] === '--base-file' && args[2] === '--head-file',
      'Usage: --base-file ABSOLUTE_PATH --head-file ABSOLUTE_PATH');
    const report = screenPinnedFiles(args[1], args[3]);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exitCode = 1; // Never infer GO from static ownership diff.
  } catch (e) {
    process.stderr.write('BLOCKED: ' + (e instanceof Error ? e.message : 'unknown') + '\n');
    process.exitCode = 2;
  }
}
