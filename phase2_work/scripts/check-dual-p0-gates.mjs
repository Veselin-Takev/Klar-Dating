#!/usr/bin/env node
/**
 * Source-only gate convergence: neither P0 tenant isolation discovery nor P0
 * retention safety checks may disappear from a future integration CI.
 * An inventory is NOT a complete tenant isolation proof or release approval.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = Object.freeze({
  'check:tenant-inventory': ['inventory-tenant-access.test.mjs', 'tenant-access-patterns.test.mjs'],
  'check:tenant-rules-surfaces': ['check-tenant-rules-surfaces.mjs', 'check-tenant-rules-surfaces.test.mjs'],
  'check:tenant-native-rules': ['check-tenant-native-rules-suite.mjs', 'check-tenant-native-rules-suite.test.mjs'],
  'check:tenant-native-storage': ['check-tenant-native-storage.mjs', 'check-tenant-native-storage.test.mjs'],
  'check:p0-native-emulator-ci': ['check-p0-native-emulator-ci.mjs', 'check-p0-native-emulator-ci.test.mjs'],
  'check:storage-tenant-risk': ['check-storage-tenant-risk-markers.mjs', 'check-storage-tenant-risk-markers.test.mjs'],
  'check:legacy-photo-purge': ['check-legacy-photo-purge.mjs'],
  'check:compliance-storage-purge': ['check-compliance-storage-purge.mjs'],
  'check:retention-census-safety': ['audit-verification-retention-backlog.test.mjs'],
  'check:purge-work-inert': ['check-purge-work-inert.mjs', 'check-purge-work-inert.test.mjs'],
});

export function dualP0GateFailures(pkg) {
  const failures = [];
  if (!pkg || typeof pkg !== 'object' || !pkg.scripts ||
      typeof pkg.scripts !== 'object') {
    return ['invalid_package_manifest'];
  }
  const ci = pkg.scripts['check:enterprise'];
  if (typeof ci !== 'string' || !ci.trim()) return ['missing_enterprise_ci_gate'];
  // Exact gate tokens, not substrings, to avoid disguised/disabled names.
  const steps = ci.split(/\s*&&\s*/).map(step => step.trim());
  for (const [name, mandatoryFragments] of Object.entries(required)) {
    const cmd = pkg.scripts[name];
    if (typeof cmd !== 'string' ||
        mandatoryFragments.some(fragment => !cmd.includes(fragment))) {
      failures.push('missing_or_invalid_' + name);
    }
    if (steps.filter(x => x === 'npm run ' + name).length !== 1) {
      failures.push('not_exactly_once_in_enterprise_' + name);
    }
  }
  if (steps.indexOf('npm run check:tenant-inventory') >
      steps.indexOf('npm run check:purge-work-inert')) {
    failures.push('tenant_inventory_must_precede_retention_prototype');
  }
  if (steps.filter(x => x === 'npm run check:dual-p0-integration').length !== 1) {
    failures.push('integration_regression_gate_not_wired');
  }
  return failures;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  try {
    const root = resolve(dirname(here), '..');
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const failed = dualP0GateFailures(pkg);
    if (failed.length) {
      process.stderr.write('BLOCKED: P0 combined gate drift: ' + failed.join(', ') + '\n');
      process.exitCode = 1;
    } else {
      process.stdout.write('PASS: tenant inventory and retention security gates all remain in enterprise CI\n');
    }
  } catch {
    process.stderr.write('BLOCKED: P0 combined gate manifest unavailable\n');
    process.exitCode = 1;
  }
}
