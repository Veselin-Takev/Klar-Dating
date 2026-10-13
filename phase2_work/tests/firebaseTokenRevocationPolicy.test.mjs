import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = server.indexOf('const requireAuth = async');
const end = server.indexOf('\n};', start);
assert.ok(start >= 0 && end > start, 'requireAuth middleware must exist');
const auth = server.slice(start, end);

test('protected authentication verifies Firebase ID-token revocation', () => {
  assert.match(auth, /verifyIdToken\(idToken,\s*true\)/);
  assert.doesNotMatch(auth, /verifyIdToken\(idToken,\s*false\)/);
});

test('Firebase identity is assigned only after verification and deletion-pending guard', () => {
  const verified = auth.indexOf('await authInstance.verifyIdToken');
  const deletion = auth.indexOf("collection('account_deletions')");
  const assigned = auth.indexOf('req.user = decodedToken');
  assert.ok(verified >= 0 && deletion > verified && assigned > deletion);
});

test('invalid or revoked token failures are not forwarded to protected routes', () => {
  assert.match(auth, /catch\s*\{/);
  assert.match(auth, /return res\.status\(401\)\.json/);
});
