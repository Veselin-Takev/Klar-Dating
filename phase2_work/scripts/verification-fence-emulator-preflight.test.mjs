import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// Execute the suite's actual preflight before any Firebase initialization.
const source = readFileSync('tests/verificationPurgeFirestoreFence.spec.ts', 'utf8');
const start = source.indexOf('const emulator =');
const end = source.indexOf('\ndescribe(', start);
assert(start >= 0 && end > start);
const guard = source.slice(start, end);
function check(override, code = guard) {
  const describe = Object.assign(() => {}, { skip() {} });
  return runInNewContext(code, {
    process: { env: {
      CI: 'true', GITHUB_ACTIONS: '', KLAR_REQUIRE_FIRESTORE_EMULATOR: '',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      GCLOUD_PROJECT: 'demo-klar', GOOGLE_CLOUD_PROJECT: 'demo-klar',
      FIREBASE_PROJECT_ID: 'demo-klar', NODE_ENV: 'test',
      KLAR_ALLOW_DURABLE_DB_FALLBACK: 'false', ...override,
    } }, readFileSync, describe,
  }, { timeout: 1000 });
}

test('general CI accepts the default emulator profile', () => {
  assert.doesNotThrow(() => check({}));
});
test('dedicated CI accepts its distinct configured profile', () => {
  assert.doesNotThrow(() => check({
    KLAR_REQUIRE_FIRESTORE_EMULATOR: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
  }));
});
test('local developer runs may skip without an emulator', () => {
  assert.doesNotThrow(() => check({ CI: '', FIRESTORE_EMULATOR_HOST: '' }));
});
for (const [label, env, error] of [
  ['CI without emulator', { FIRESTORE_EMULATOR_HOST: '' }, /fence_firestore_emulator_required/],
  ['GitHub Actions without CI sentinel', { CI: '', GITHUB_ACTIONS: 'true', FIRESTORE_EMULATOR_HOST: '' }, /fence_firestore_emulator_required/],
  ['dedicated run without emulator', { CI: '', KLAR_REQUIRE_FIRESTORE_EMULATOR: '1', FIRESTORE_EMULATOR_HOST: '' }, /fence_firestore_emulator_required/],
  ['remote endpoint', { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:8080' }, /fence_emulator_unsafe_target/],
  ['default run using dedicated port', { FIRESTORE_EMULATOR_HOST: 'localhost:8085' }, /fence_emulator_unsafe_target/],
  ['dedicated run using default port', { KLAR_REQUIRE_FIRESTORE_EMULATOR: '1' }, /fence_emulator_unsafe_target/],
  ...['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID'].map(key =>
    [key + ' disagreement', { [key]: 'production-app' }, /fence_emulator_unsafe_target/]),
  ['production runtime', { NODE_ENV: 'production' }, /fence_emulator_unsafe_target/],
  ['durable fallback', { KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' }, /fence_emulator_unsafe_target/],
]) {
  test('refuses ' + label + ' before SDK initialization', () => {
    assert.throws(() => check(env), error);
  });
}
test('the regression detects removal of either CI sentinel', () => {
  for (const sentinel of ['CI', 'GITHUB_ACTIONS']) {
    const mutated = guard.replace(` || process.env.${sentinel} === 'true'`, '');
    assert.notEqual(mutated, guard);
    assert.doesNotThrow(() => check({
      CI: '', GITHUB_ACTIONS: '', [sentinel]: 'true', FIRESTORE_EMULATOR_HOST: '',
    }, mutated));
  }
});
