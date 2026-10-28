import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve('scripts/run-retention-emulator.mjs');
function assertDenied(overrides) {
  const env = {
    ...process.env, FIRESTORE_EMULATOR_HOST: '', GCLOUD_PROJECT: 'demo-klar',
    GOOGLE_CLOUD_PROJECT: 'demo-klar', FIREBASE_PROJECT_ID: 'demo-klar',
    KLAR_ALLOW_DURABLE_DB_FALLBACK: '', NODE_ENV: 'test', ...overrides,
  };
  const out = spawnSync(process.execPath, [script], {
    cwd: process.cwd(), env, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(out.status, 2, 'Expected fail-closed preflight: ' + out.stderr);
  assert.match(out.stderr, /Emulator required/);
}
test('A-15 refuses absent Firestore Emulator', () => assertDenied({}));
test('A-15 refuses non-loopback target', () => assertDenied({ FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:8085' }));
test('A-15 refuses incorrect port', () => assertDenied({ FIRESTORE_EMULATOR_HOST: 'localhost:8080' }));
test('A-15 refuses non-demo project', () => assertDenied({ FIRESTORE_EMULATOR_HOST: 'localhost:8085', GCLOUD_PROJECT: 'production-project' }));
test('A-15 refuses durable fallback', () => assertDenied({ FIRESTORE_EMULATOR_HOST: 'localhost:8085', KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' }));
test('A-15 refuses production runtime', () => assertDenied({ FIRESTORE_EMULATOR_HOST: 'localhost:8085', NODE_ENV: 'production' }));
