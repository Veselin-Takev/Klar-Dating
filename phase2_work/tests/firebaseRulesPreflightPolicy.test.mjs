import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const preflight = readFileSync(new URL('../scripts/check-rules-prerequisites.mjs', import.meta.url), 'utf8');
test('every Firestore rules task triggers the same fail-fast preflight', () => {
  for (const suffix of ['rules', 'rules-diagnose', 'rules-sprache']) {
    expect(pkg.scripts['pretest:' + suffix]).toBe('node scripts/check-rules-prerequisites.mjs');
    expect(pkg.scripts['test:' + suffix]).toMatch(/firebase emulators:exec/);
  }
});
test('preflight requires pinned Node family, installed local CLI and Java 21+', () => {
  expect(preflight).toMatch(/major !== 22/);
  expect(preflight).toMatch(/minor === 23 && patch < 3/);
  expect(preflight).toMatch(/node_modules\/firebase-tools\/lib\/bin\/firebase\.js/);
  expect(preflight).toMatch(/majorJava < 21/);
});
