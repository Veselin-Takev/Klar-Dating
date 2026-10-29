import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runner = resolve(root, 'scripts/run-partner-conversion-concurrency-emulator.mjs');

// These negative checks never start an emulator and never connect to Firestore.
// All invocations must fail before spawnSync can launch Vitest.
const baseline = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '',
  GCLOUD_PROJECT: 'demo-klar',
  GOOGLE_CLOUD_PROJECT: 'demo-klar',
  FIREBASE_PROJECT_ID: 'demo-klar',
  NODE_ENV: 'test',
  KLAR_ALLOW_DURABLE_DB_FALLBACK: 'false',
  KLAR_RUN_PARTNER_CONVERSION_EMULATOR: '1',
};

const invalidConfigurations = [
  ['missing emulator host', {}],
  ['non-loopback emulator host', { FIRESTORE_EMULATOR_HOST: 'firestore.example.invalid:8085' }],
  ['wrong local port', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8086' }],
  ['host containing extra suffix', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085@elsewhere.invalid' }],
  ['production runtime', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', NODE_ENV: 'production' }],
  ['durable database fallback enabled', {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
    KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true',
  }],
  ['mismatched GCLOUD project', {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
    GCLOUD_PROJECT: 'klar-production',
  }],
  ['mismatched Firebase project', {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
    FIREBASE_PROJECT_ID: 'klar-production',
  }],
];

for (const [name, overrides] of invalidConfigurations) {
  test(`dedicated partner conversion emulator runner fails closed: ${name}`, () => {
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      env: { ...baseline, ...overrides },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.error, undefined, `unable to launch runner: ${result.error?.message}`);
    assert.equal(result.status, 2, `unexpected runner exit for ${name}: ${result.stderr}`);
    assert.match(result.stderr, /requires local demo-klar Firestore emulator; fail closed/);
  });
}
