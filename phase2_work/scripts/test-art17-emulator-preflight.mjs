#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = 'scripts/run-art17-partner-emulator.mjs';
const environment = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '',
  GCLOUD_PROJECT: 'demo-klar',
  GOOGLE_CLOUD_PROJECT: 'demo-klar',
};
for (const [label, variables] of [
  ['absent emulator host', {}],
  ['remote host', { FIRESTORE_EMULATOR_HOST: 'example.com:8085' }],
  ['production-like host', { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:8085' }],
  ['wrong emulator port', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
  ['invalid emulator project', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GCLOUD_PROJECT: 'production-app' }],
  ['invalid second project', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', GOOGLE_CLOUD_PROJECT: 'production-app' }],
  ['firebase project disagreement', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_PROJECT_ID: 'production-app' }],
  ['enabled durable fallback', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' }],
  ['production runtime', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', NODE_ENV: 'production' }],
]) {
  test(`refuses ${label} before Vitest or Firestore runs`, () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...environment, ...variables },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 2, `${label}: ${result.stdout} ${result.stderr}`);
    assert.match(result.stderr, /Firestore Emulator required/);
  });
}

const source = readFileSync('tests/partnerReferralDeletionEmulator.spec.ts', 'utf8');
const start = source.indexOf('const activeEmulatorHost =');
const end = source.indexOf('// Run with the real Firestore emulator.', start);
assert(start >= 0 && end > start, 'direct Vitest Firestore guard must exist before describe');
const directlyExecutedGuard = source.slice(start, end);
function checkDirectGuard(override) {
  const env = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
    GCLOUD_PROJECT: 'demo-klar',
    GOOGLE_CLOUD_PROJECT: 'demo-klar',
    FIREBASE_PROJECT_ID: 'demo-klar',
    NODE_ENV: 'test',
    KLAR_ALLOW_DURABLE_DB_FALLBACK: 'false',
    ...override,
  };
  runInNewContext(directlyExecutedGuard, {
    process: { env, cwd: () => process.cwd() },
    readFileSync: () => JSON.stringify({ emulators: { firestore: { port: 8085 } } }),
    resolve: (...parts) => parts.join('/'),
    JSON,
    Error,
  }, { timeout: 2000 });
}
test('direct Vitest guard accepts a demo project on local configured emulator port', () => {
  assert.doesNotThrow(() => checkDirectGuard({}));
});
for (const [label, params] of [
  ['absent host', { FIRESTORE_EMULATOR_HOST: '', KLAR_REQUIRE_FIRESTORE_EMULATOR: '1' }],
  ['external host', { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:8085' }],
  ['wrong port', { FIRESTORE_EMULATOR_HOST: 'localhost:8080' }],
  ['GCLOUD project changed', { GCLOUD_PROJECT: 'production-project' }],
  ['GOOGLE project changed', { GOOGLE_CLOUD_PROJECT: 'production-project' }],
  ['Firebase project changed', { FIREBASE_PROJECT_ID: 'production-project' }],
  ['durable fallback enabled', { KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' }],
  ['production environment', { NODE_ENV: 'production' }],
]) {
  test('direct Vitest guard rejects ' + label + ' before Firebase SDK initialization', () => {
    assert.throws(() => checkDirectGuard(params), /art17_firestore_emulator_unsafe_target/);
  });
}
