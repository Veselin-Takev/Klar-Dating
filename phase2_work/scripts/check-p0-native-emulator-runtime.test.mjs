/**
 * Deliberately execute the REAL three P0 native emulator Vitest files in a
 * child with CI=true and NO emulators. A safe harness must fail from each
 * beforeAll loopback guard, never silently skip, nor call live Firebase.
 *
 * No mocks of the suite under test, no GCS/Firestore data operations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = Object.freeze([
  'tests/tenantStorageBoundary.emulator.spec.ts',
  'tests/tenantRulesBoundary.emulator.spec.ts',
  'tests/verificationPurgeWorkFirestore.emulator.spec.ts',
]);
const requiredErrors = Object.freeze([
  'tenant_storage_loopback_required',
  'firebase_rules_loopback_emulator_required',
  'retention_firestore_emulator_loopback_required',
]);

test('P0 native Firebase safety suites actually FAIL without emulators in GitHub CI', () => {
  const env = {
    ...process.env,
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GCLOUD_PROJECT: 'demo-klar',
    GOOGLE_CLOUD_PROJECT: 'demo-klar',
    FIRESTORE_EMULATOR_HOST: '',
    FIREBASE_STORAGE_EMULATOR_HOST: '',
    FIREBASE_AUTH_EMULATOR_HOST: '',
    GOOGLE_APPLICATION_CREDENTIALS: '',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  const outcome = spawnSync(process.execPath, [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    'vitest.config.ts',
    ...paths,
  ], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (outcome.error) throw outcome.error;
  const log = (outcome.stdout || '') + '\n' + (outcome.stderr || '');
  assert.equal(outcome.signal, null, 'child Vitest terminated unexpectedly');
  assert.equal(outcome.status, 1, 'mandatory native P0 tests unexpectedly succeeded or skipped: ' + log.slice(-3500));
  for (const expected of requiredErrors) {
    assert.ok(log.includes(expected), 'missing native fail-closed signal '+expected+': '+log.slice(-3500));
  }
  for (const path of paths) {
    assert.ok(log.includes(path), 'native test file did not run: ' + path);
  }
  assert.match(log, /Test Files\s+3 failed/, 'all 3 native P0 suites must be marked failed, not skipped');
});
