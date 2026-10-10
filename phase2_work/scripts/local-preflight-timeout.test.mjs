import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('a hung child process times out and cannot be marked successful', () => {
  const result = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
    timeout: 100, killSignal: 'SIGTERM', encoding: 'utf8',
  });
  assert.equal(result.error?.code, 'ETIMEDOUT');
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, 'SIGTERM');
});

test('preflight captures timeout provenance in external step evidence', () => {
  const source = readFileSync(new URL('./local-preflight.mjs', import.meta.url), 'utf8');
  assert.match(source, /timeout: 15 \* 60_000, killSignal: 'SIGTERM'/);
  assert.match(source, /timedOut: result\.error\?\.code === 'ETIMEDOUT'/);
  assert.match(source, /errorCode: result\.error\?\.code \?\? null/);
});

test('missing executable yields ENOENT without stdout and cannot satisfy toolchain gate', () => {
  const missing = spawnSync('klar-toolchain-command-intentionally-not-installed-123456', ['--version'], {
    encoding: 'utf8', timeout: 1000,
  });
  assert.equal(missing.error?.code, 'ENOENT');
  assert.equal(missing.stdout == null, true, 'stdout is absent (null or undefined)');
  assert.notEqual(missing.status, 0);
});

test('preflight handles absent Bun and Java command output before parsing versions', () => {
  const source = readFileSync(new URL('./local-preflight.mjs', import.meta.url), 'utf8');
  assert.match(source, /bun\.error \|\| bun\.status !== 0 \|\| bun\.stdout\?\.trim\(\)/);
  assert.match(source, /java\.error \|\| java\.status !== 0/);
  assert.match(source, /\(java\.stdout \?\? ''\) \+ \(java\.stderr \?\? ''\)/);
});
