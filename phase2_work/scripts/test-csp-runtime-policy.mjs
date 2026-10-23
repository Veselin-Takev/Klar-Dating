import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldEnforceContentSecurityPolicy, shouldPermitEmulatorCspSources } from '../src/server/cspRuntimePolicy.ts';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;

test('production CSP remains enforced regardless of client/emulator flags', () => {
  for (const extra of [
    {},
    { VITE_EMULATOR: 'true' },
    { VITE_EMULATOR: 'false' },
    { VITE_EMULATOR: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { KLAR_RUNTIME_ENV: 'local', KLAR_ALLOW_LOCAL_EMULATOR_CSP: 'true', VITE_EMULATOR: 'true' },
  ]) {
    assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'production', ...extra }), true);
  }
  assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'development', VITE_EMULATOR: 'true' }), false);
  assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'test' }), false);
  assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'development', KLAR_RUNTIME_ENV: 'production' }), true);
  assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'development', K_SERVICE: 'klar-api' }), true);
});

test('production emulator CSP origins require explicit local-only opt in', () => {
  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', VITE_EMULATOR: 'true' },
    { NODE_ENV: 'production', KLAR_ALLOW_LOCAL_EMULATOR_CSP: 'true' },
    { NODE_ENV: 'production', KLAR_RUNTIME_ENV: 'local' },
    { NODE_ENV: 'production', KLAR_RUNTIME_ENV: 'staging', KLAR_ALLOW_LOCAL_EMULATOR_CSP: 'true' },
  ]) assert.equal(shouldPermitEmulatorCspSources(env), false);
  const local = { NODE_ENV: 'production', KLAR_RUNTIME_ENV: 'local', KLAR_ALLOW_LOCAL_EMULATOR_CSP: 'true' };
  assert.equal(shouldPermitEmulatorCspSources(local), true);
  assert.equal(shouldPermitEmulatorCspSources({ NODE_ENV: 'development', KLAR_RUNTIME_ENV: 'production' }), false);
  for (const [key, value] of [
    ['K_SERVICE', 'klar-cloud-run'], ['GAE_ENV', 'standard'],
    ['FUNCTION_TARGET', 'serve'], ['FUNCTION_NAME', 'serve'],
  ]) {
    assert.equal(shouldEnforceContentSecurityPolicy({ NODE_ENV: 'development', [key]: value }), true);
    assert.equal(shouldPermitEmulatorCspSources({ ...local, [key]: value }), false,
      `${key} must deny a local CSP exception on hosted Cloud runtimes`);
  }
});

test('actual Helmet production CSP and emulator extension are wired to guarded decisions', () => {
  assert.match(source, /const istProduktion = shouldEnforceContentSecurityPolicy\(process\.env\);/);
  assert.match(source, /const emulatorCspFreigegeben = shouldPermitEmulatorCspSources\(process\.env\);/);
  assert.match(source, /contentSecurityPolicy:\s*istProduktion\s*\?/);
  assert.match(source, /emulatorCspFreigegeben \? process\.env\.FIRESTORE_EMULATOR_HOST : undefined/);
  assert.match(source, /emulatorCspFreigegeben \? process\.env\.FIREBASE_AUTH_EMULATOR_HOST : undefined/);
  assert.doesNotMatch(source, /NODE_ENV\s*===\s*["']production["']\s*&&\s*process\.env\.VITE_EMULATOR/);
  assert.match(scripts['start:lokal'], /KLAR_RUNTIME_ENV=local KLAR_ALLOW_LOCAL_EMULATOR_CSP=true/);
  assert.match(scripts['check:csp'], /test-csp-runtime-policy\.mjs/);
});
