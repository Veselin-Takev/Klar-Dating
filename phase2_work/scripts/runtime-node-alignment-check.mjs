import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dockerfile = readFileSync(join(appRoot, 'Dockerfile'), 'utf8');

function checkRuntime(imageSource) {
  const fixture = mkdtempSync(join(tmpdir(), 'klar-runtime-policy-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    for (const file of ['package.json', 'scripts/check-ci-toolchain-pins.mjs']) {
      writeFileSync(join(fixture, file), readFileSync(join(appRoot, file)));
    }
    writeFileSync(join(fixture, 'Dockerfile'), imageSource);
    return spawnSync(process.execPath, [join(appRoot, 'scripts/check-runtime-node-alignment.mjs')], {
      cwd: fixture, encoding: 'utf8', timeout: 10_000,
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('the committed runtime satisfies the approved policy', () => {
  const result = checkRuntime(dockerfile);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test('a Node major upgrade is rejected before dependency installation', () => {
  const changed = dockerfile.replace('node:22.23.3-bookworm-slim@', 'node:26.10.0-bookworm-slim@');
  assert.notEqual(changed, dockerfile);
  const result = checkRuntime(changed);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Docker runtime must pin/);
});

test('an unreviewed runtime digest is rejected', () => {
  const changed = dockerfile.replace(/(FROM node:[^\s]+@sha256:)[a-f0-9]{64}/, '$1' + '0'.repeat(64));
  assert.notEqual(changed, dockerfile);
  const result = checkRuntime(changed);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Docker runtime must pin/);
});
