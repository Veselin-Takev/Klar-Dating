import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFirebaseCredentials } from './check-local-firebase-adc.mjs';

test('local emulator setup does not require ADC', () => {
  assert.deepEqual(inspectFirebaseCredentials({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    GCLOUD_PROJECT: 'demo-klar',
  }, { exists: () => false }), { mode: 'emulator', ok: true, issues: [] });
});
test('non-demo project is rejected for emulator mode', () => {
  assert.equal(inspectFirebaseCredentials({
    FIRESTORE_EMULATOR_HOST: 'localhost:8080',
    FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
    GCLOUD_PROJECT: 'klar-prod',
  }).ok, false);
});
test('mixed emulator and cloud configuration is rejected', () => {
  assert.equal(inspectFirebaseCredentials({ FIRESTORE_EMULATOR_HOST: 'localhost:8080' }).ok, false);
});
test('no local ADC fails closed without managed runtime', () => {
  const result = inspectFirebaseCredentials({}, { home: '/no-home', exists: () => false });
  assert.equal(result.ok, false);
  assert.match(result.issues.join(' '), /Application Default Credentials/);
});
test('explicit ADC file must exist at an absolute path', () => {
  assert.equal(inspectFirebaseCredentials({ GOOGLE_APPLICATION_CREDENTIALS: 'missing.json' }, { exists: () => false }).ok, false);
  assert.equal(inspectFirebaseCredentials({ GOOGLE_APPLICATION_CREDENTIALS: '/private/auth.json' }, { exists: () => true }).ok, true);
});
test('managed Google Cloud runtime uses metadata-based ADC', () => {
  assert.equal(inspectFirebaseCredentials({ K_SERVICE: 'klar' }, { exists: () => false }).ok, true);
});
