import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(root, 'scripts/audit-verification-retention-backlog.mjs');

function invoke(args, overrides = {}) {
  const env = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: '',
    GOOGLE_CLOUD_PROJECT: '',
    GCLOUD_PROJECT: '',
    ...overrides,
  };
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root, env, encoding: 'utf8', timeout: 8_000,
  });
}

for (const [title, args, overrides] of [
  ['missing emulator flag', [], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-klar' }],
  ['non-demo project', ['--emulator-only'], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'real-customer-prod' }],
  ['public network endpoint', ['--emulator-only'], { FIRESTORE_EMULATOR_HOST: '10.0.0.4:8080', GCLOUD_PROJECT: 'demo-klar' }],
  ['invalid DNS endpoint', ['--emulator-only'], { FIRESTORE_EMULATOR_HOST: 'example.org:8080', GCLOUD_PROJECT: 'demo-klar' }],
  ['no endpoint', ['--emulator-only'], { GCLOUD_PROJECT: 'demo-klar' }],
  ['no project', ['--emulator-only'], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
  ['unrecognized flags', ['--emulator-only', '--allow-production'], {
    GCLOUD_PROJECT: 'demo-klar', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  }],
]) {
  test('refuses ' + title + ' without touching Firestore', () => {
    const result = invoke(args, overrides);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Refused/);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /customer|verification\/|secret-user/);
  });
}
