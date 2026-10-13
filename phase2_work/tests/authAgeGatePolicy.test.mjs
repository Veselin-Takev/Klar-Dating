import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Source-policy regression only. Functional middleware behavior still requires
// emulator-backed HTTP tests before release.
const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const gate = source.slice(source.indexOf('app.use("/api", async (req, res, next) => {'));

test('protected age/consent middleware fails closed on absent identity', () => {
  assert.match(gate, /const meineUid = req\.user\?\.uid;/);
  assert.match(gate, /if \(!meineUid\)\s*\{\s*return res\.status\(401\)\.json\(\{[\s\S]*?code: 'auth_required'/);
  assert.doesNotMatch(gate, /if \(!meineUid\) return next\(\)/);
});

test('public and age-exemption branches remain before identity guard', () => {
  const exemption = gate.indexOf('if (OHNE_ALTERSPRUEFUNG.has(pfad)) return next();');
  const identity = gate.indexOf('const meineUid = req.user?.uid;');
  assert.ok(exemption >= 0 && identity > exemption);
});
