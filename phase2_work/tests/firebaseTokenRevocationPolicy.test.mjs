import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = server.indexOf('const requireAuth = async');
const end = server.indexOf('\n};', start);
if (!(start >= 0 && end > start)) throw new Error('requireAuth middleware must exist');
const auth = server.slice(start, end);

test('protected authentication verifies Firebase ID-token revocation', () => {
  expect(auth).toMatch(/verifyIdToken\(idToken,\s*true\)/);
  expect(auth).not.toMatch(/verifyIdToken\(idToken,\s*false\)/);
});

test('Firebase identity is assigned only after verification and deletion-pending guard', () => {
  const verified = auth.indexOf('await authInstance.verifyIdToken');
  const deletion = auth.indexOf("collection('account_deletions')");
  const assigned = auth.indexOf('req.user = decodedToken');
  expect(verified >= 0 && deletion > verified && assigned > deletion).toBe(true);
});

test('invalid or revoked token failures are not forwarded to protected routes', () => {
  expect(auth).toMatch(/catch\s*\{/);
  expect(auth).toMatch(/return res\.status\(401\)\.json/);
});
