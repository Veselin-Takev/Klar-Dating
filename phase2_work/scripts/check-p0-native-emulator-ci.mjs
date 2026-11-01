#!/usr/bin/env node
/**
 * P0 #202/#254: fail closed if required native Firebase emulator tests can be
 * silently skipped by a GitHub Actions CI run. Source wiring is NOT run proof.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredSuites = Object.freeze([
  ['tenant_storage', 'tests/tenantStorageBoundary.emulator.spec.ts'],
  ['tenant_firestore', 'tests/tenantRulesBoundary.emulator.spec.ts'],
  ['retention_firestore', 'tests/verificationPurgeWorkFirestore.emulator.spec.ts'],
]);

export function nativeP0CIFailures({ suites, vitest, manifest }) {
  const failures = [];
  const declaration = "const ciRequiresEmulator = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';";
  for (const [name, path] of requiredSuites) {
    const source = suites?.[path];
    if (typeof source !== 'string' || !source.includes(declaration) ||
        !source.includes('describe.skipIf(!emulatorOnly && !ciRequiresEmulator)')) {
      failures.push(name + '_ci_may_skip');
    }
    // All suites must reject a missing, non-loopback or non-demo emulator
    // before constructing an SDK or attempting any external access.
    if (typeof source !== 'string' ||
        !/if\s*\(!emulatorOnly(?:\s*\|\|\s*!match)?\)\s*throw new Error\(/.test(source) ||
        !source.includes("projectId: 'demo-klar'")) {
      failures.push(name + '_unsafe_emulator_boundary');
    }
    if (typeof vitest !== 'string' ||
        vitest.includes("'" + '**/' + path + "'") ||
        vitest.includes('"' + '**/' + path + '"')) {
      failures.push(name + '_vitest_excluded');
    }
  }
  const ci = manifest?.scripts?.['test:ci'];
  if (typeof ci !== 'string' || !ci.includes('emulators:exec --project demo-klar') ||
      !ci.includes('--only auth,firestore,storage') || !ci.includes('npm test')) {
    failures.push('required_firebase_emulators_not_started');
  }
  const enterprise = manifest?.scripts?.['check:enterprise'];
  if (typeof enterprise !== 'string' ||
      enterprise.split(/\s*&&\s*/).filter(s => s === 'npm run check:p0-native-emulator-ci').length !== 1) {
    failures.push('mandatory_source_gate_not_wired_once');
  }
  const command = manifest?.scripts?.['check:p0-native-emulator-ci'];
  if (typeof command !== 'string' ||
      !command.includes('check-p0-native-emulator-ci.mjs') ||
      !command.includes('check-p0-native-emulator-ci.test.mjs') ||
      !command.includes('check-p0-native-emulator-runtime.test.mjs')) {
    failures.push('mandatory_source_and_negative_tests_missing');
  }
  return failures;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  try {
    const root = resolve(dirname(here), '..');
    const suites = Object.fromEntries(requiredSuites.map(([, path]) =>
      [path, readFileSync(resolve(root, path), 'utf8')]));
    const vitest = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8');
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const failures = nativeP0CIFailures({ suites, vitest, manifest });
    if (failures.length) {
      process.stderr.write('BLOCKED: P0 native CI emulator evidence: ' + failures.join(', ') + '\n');
      process.exitCode = 1;
    } else {
      process.stdout.write('PASS: P0 native emulator suites fail closed in mandatory CI (source only)\n');
    }
  } catch {
    process.stderr.write('BLOCKED: P0 emulator CI source evidence not readable\n');
    process.exitCode = 1;
  }
}
