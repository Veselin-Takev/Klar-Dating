import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'server.ts'), 'utf8');
const middleware = readFileSync(join(root, 'src/core/auth/authMiddleware.ts'), 'utf8');
function check(server, core) {
  const fixture = mkdtempSync(join(tmpdir(), 'klar-auth-boundary-'));
  try {
    mkdirSync(join(fixture, 'src/core/auth'), { recursive: true });
    writeFileSync(join(fixture, 'server.ts'), server);
    writeFileSync(join(fixture, 'src/core/auth/authMiddleware.ts'), core);
    return spawnSync(process.execPath, [join(root, 'scripts/check-auth-boundary.mjs')], { cwd: fixture, encoding: 'utf8', timeout: 10000 });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
}
test('both committed authentication paths satisfy revocation policy', () => {
  assert.ok(source.includes('verifyIdToken(idToken, true)'));
  assert.ok(middleware.includes('verifyIdToken(token, true)'));
  const result = check(source, middleware);
  assert.equal(result.status, 0, result.stderr);
});
for (const mode of ['server', 'core']) {
  test(`rejects disabled revocation checking in ${mode}`, () => {
    const server = mode === 'server' ? source.replace('verifyIdToken(idToken, true)', 'verifyIdToken(idToken, false)') : source;
    const core = mode === 'core' ? middleware.replace('verifyIdToken(token, true)', 'verifyIdToken(token, false)') : middleware;
    const result = check(server, core);
    assert.equal(result.status, 1, result.stdout);
  });
}
test('rejects signature-only verification with the default argument', () => {
  const result = check(source.replace('verifyIdToken(idToken, true)', 'verifyIdToken(idToken)'), middleware);
  assert.equal(result.status, 1, result.stdout);
});
