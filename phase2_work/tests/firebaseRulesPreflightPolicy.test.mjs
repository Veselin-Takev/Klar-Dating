import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const preflight = readFileSync(new URL('../scripts/check-rules-prerequisites.mjs', import.meta.url), 'utf8');
test('every Firestore rules task triggers the same fail-fast preflight', () => {
  for (const suffix of ['rules', 'rules-diagnose', 'rules-sprache']) {
    assert.equal(pkg.scripts['pretest:' + suffix], 'node scripts/check-rules-prerequisites.mjs');
    assert.match(pkg.scripts['test:' + suffix], /firebase emulators:exec/);
  }
});
test('preflight requires pinned Node family, installed local CLI and Java 21+', () => {
  assert.match(preflight, /major !== 22/);
  assert.match(preflight, /minor === 23 && patch < 3/);
  assert.match(preflight, /node_modules\/firebase-tools\/lib\/bin\/firebase\.js/);
  assert.match(preflight, /majorJava < 21/);
});
