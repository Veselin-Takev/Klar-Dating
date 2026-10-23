#!/usr/bin/env node
/**
 * Read-only pre-host screening of the immutable PR #119 SCA gate contract.
 * A successful static screen is never a release PASS or approval.
 * No subprocesses, registry calls, dependency installs, or writes.
 */
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
export const TARGET_TREE = '05f22f0ca387ae37573b1f81e85ead901dce3da9';
export const ORIGINAL_GATE_07 = 'npm audit --audit-level=high';
export const ORIGINAL_GATES = Object.freeze([
  'npm run check:enterprise',
  'node scripts/check-secrets.mjs',
  'node scripts/check-auth-boundary.mjs',
  'node scripts/check-public-firestore-rules.mjs',
  'node scripts/check-ai-pii-sanitizer.mjs',
  'node scripts/check-art17-deletion-audit.mjs 0',
  ORIGINAL_GATE_07,
  'npx gitleaks detect --source . --no-git',
  'npx semgrep --config=auto --error',
  'npm run typecheck',
  'npm run test:pure',
  'npm run test:rules',
  'npx playwright test',
  'npm run build',
  'npx eslint . --max-warnings=0',
]);

function safelyRead(root, rel, issues, label) {
  const path = join(root, rel);
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      issues.push(`${label}: not a regular, unique, non-symlink file`);
      return null;
    }
    if (stat.size > 3_000_000 || stat.size < 1) {
      issues.push(`${label}: missing contents or above 3MB metadata limit`);
      return null;
    }
    return readFileSync(path, 'utf8');
  } catch (error) {
    issues.push(`${label}: unavailable (${error.code || 'unreadable'})`);
    return null;
  }
}

function safelyCheckPresence(root, rel, issues, label) {
  const p = join(root, rel);
  try {
    const stat = lstatSync(p);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size === 0) {
      issues.push(`${label}: invalid lockfile type/content`);
      return false;
    }
    return true;
  } catch (error) {
    issues.push(`${label}: missing (${error.code || 'unreadable'})`);
    return false;
  }
}

export function screenSCAGateContract(sourceRoot) {
  const issues = [];
  const warnings = [];
  const root = resolve(sourceRoot);
  const app = join(root, 'phase2_work');
  const policy = safelyRead(root, 'phase2_work/scripts/check-dependency-locks.mjs', issues, 'dependency-lock policy');
  const rawApp = safelyRead(root, 'phase2_work/package.json', issues, 'application package.json');
  const rawFunctions = safelyRead(root, 'phase2_work/functions/package.json', issues, 'Functions package.json');
  let appPkg = null, fnPkg = null;
  try { if (rawApp !== null) appPkg = JSON.parse(rawApp); } catch { issues.push('application package.json: invalid JSON'); }
  try { if (rawFunctions !== null) fnPkg = JSON.parse(rawFunctions); } catch { issues.push('Functions package.json: invalid JSON'); }
  if (appPkg) {
    if (appPkg.packageManager !== 'bun@1.4.2') issues.push('application package manager no longer pinned to bun@1.4.2');
    if (appPkg.engines?.node !== '>=22.23.3') issues.push('application Node.js engine is not >=22.23.3');
    if (!appPkg.scripts?.['check:enterprise'] || !appPkg.scripts?.typecheck || !appPkg.scripts?.['test:pure'] || !appPkg.scripts?.['test:rules'] || !appPkg.scripts?.build) {
      issues.push('application mandatory npm script mapping incomplete');
    }
  }
  if (fnPkg && (!fnPkg.name || typeof fnPkg.name !== 'string')) issues.push('Functions package.json missing package name');
  const appBunLock = safelyCheckPresence(root, 'phase2_work/bun.lock', issues, 'application Bun lock');
  const fnNpmLock = safelyCheckPresence(root, 'phase2_work/functions/package-lock.json', issues, 'Functions npm lock');
  let appNpmLock = false;
  try { appNpmLock = existsSync(join(app, 'package-lock.json')) || existsSync(join(app, 'npm-shrinkwrap.json')); } catch { issues.push('cannot inspect application npm lockfiles'); }
  if (appNpmLock) issues.push('unexpected application npm lock contradicts declared Bun-only policy');
  if (!policy || !policy.includes("package-lock.json must not coexist with the Bun-only root dependency policy.")) {
    issues.push('Bun-only policy guard missing or changed; manual policy review required');
  }
  // The command for gate 07 belongs to immutable original release instructions, not user-configurable data.
  const gate07Conflict = !!(appBunLock && !appNpmLock && appPkg?.packageManager === 'bun@1.4.2');
  if (gate07Conflict) issues.push('GATE_07_CONFLICT: npm audit requires a package-lock/shrinkwrap by default, but Bun-only application policy forbids it');
  if (appPkg && !(appPkg.dependencies?.gitleaks || appPkg.devDependencies?.gitleaks)) warnings.push('GATE_08_PROVENANCE: no pinned Gitleaks binary is declared in application package.json');
  if (appPkg && !(appPkg.dependencies?.semgrep || appPkg.devDependencies?.semgrep)) warnings.push('GATE_09_PROVENANCE: no pinned Semgrep binary is declared in application package.json');
  if (!fnNpmLock) warnings.push('Functions npm vulnerability coverage blocked until Functions npm lock exists');
  return {
    target_commit: TARGET_SHA,
    target_tree: TARGET_TREE,
    checkout_identity_attested: false,
    scanner_executions: 0,
    release_decision: 'NO-GO',
    audit_contract_status: issues.length ? 'BLOCKED' : 'STATIC_ONLY',
    mandatory_gate07: ORIGINAL_GATE_07,
    mandatory_gate_count: ORIGINAL_GATES.length,
    mandatory_host_gates_pass_evidenced: 0,
    independent_approvals_evidenced: 0,
    dependency_graphs: { application: 'bun.lock', functions: 'functions/package-lock.json' },
    findings: issues,
    additional_review_items: warnings,
    required_human_action: 'Security and Release Owner must approve a versioned two-graph SCA contract; no automatic gate substitution',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || resolve(fileURLToPath(import.meta.url), '../../..');
  const result = screenSCAGateContract(root);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.audit_contract_status === 'BLOCKED' ? 1 : 0;
}
