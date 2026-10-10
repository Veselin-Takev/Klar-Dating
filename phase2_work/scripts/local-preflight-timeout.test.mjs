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
