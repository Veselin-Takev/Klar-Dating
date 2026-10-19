import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = 'scripts/check-rules-prerequisites.mjs';
const safe = { ...process.env, NODE_ENV: 'test', KLAR_ALLOW_DURABLE_DB_FALLBACK: 'false' };
function run(override) {
  return spawnSync(process.execPath, [script], { cwd: process.cwd(), env: { ...safe, ...override }, encoding: 'utf8', timeout: 10000 });
}

test('production processes are never eligible to start Rules Emulator tests', () => {
  const result = run({ NODE_ENV: 'production' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /production runtime/);
});

test('dangerous durable fallback cannot silently satisfy emulator test setup', () => {
  const result = run({ KLAR_ALLOW_DURABLE_DB_FALLBACK: 'true' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /durable fallback/);
});

test('recommended installation preserves the Bun-only application lockfile', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /use bun ci from the committed bun\.lock/);
  assert.match(source, /npm ci is forbidden by the root lockfile policy/);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const key of ['test:rules', 'test:rules-diagnose', 'test:rules-sprache', 'test:art17-partner-emulator']) {
    assert.match(pkg.scripts[key], /^node scripts\/check-emulator-ports\.mjs --config firebase\.pruefung\.json && firebase emulators:exec/);
  }
});
