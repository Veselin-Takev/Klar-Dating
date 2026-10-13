import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Source-policy regression only. Functional middleware behavior still requires
// emulator-backed HTTP tests before release.
const source = readFileSync('server.ts', 'utf8');
const gate = source.slice(source.indexOf('app.use("/api", async (req, res, next) => {'));

test('protected age/consent middleware fails closed on absent identity', () => {
  expect(gate).toMatch(/const meineUid = req\.user\?\.uid;/);
  expect(gate).toMatch(/if \(!meineUid\)\s*\{\s*return res\.status\(401\)\.json\(\{[\s\S]*?code: 'auth_required'/);
  expect(gate).not.toMatch(/if \(!meineUid\) return next\(\)/);
});

test('public and age-exemption branches remain before identity guard', () => {
  const exemption = gate.indexOf('if (OHNE_ALTERSPRUEFUNG.has(pfad)) return next();');
  const identity = gate.indexOf('const meineUid = req.user?.uid;');
  expect(exemption >= 0 && identity > exemption).toBe(true);
});
