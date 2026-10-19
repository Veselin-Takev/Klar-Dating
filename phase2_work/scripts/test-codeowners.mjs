import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCodeowners, ownersForPath, requiredOwnership } from './check-codeowners.mjs';

const source = readFileSync(new URL('../../CODEOWNERS', import.meta.url), 'utf8');

test('active phase2_work security, finance and workflows have specialized path assignments', () => {
  assert.deepEqual(checkCodeowners(source), []);
  assert.equal(Object.keys(requiredOwnership).length, 17);
});
test('last matching CODEOWNERS entry wins, including harmful later generic overrides', () => {
  const modified = source + '\n/phase2_work/ @klar/engineering\n';
  assert(checkCodeowners(modified).some(s => s.includes('authorization.ts')));
});
test('GitHub root paths do not implicitly own phase2_work files', () => {
  const oldOnly = source.split('# Active application')[0];
  assert(!ownersForPath(oldOnly, 'phase2_work/src/server/authorization.ts').includes('@klar/security'));
});
test('removing a partner finance owner fails the sensitive-path policy', () => {
  const modified = source.replace('/phase2_work/src/server/stripeService.ts @klar/security @klar/finance @klar/engineering',
    '/phase2_work/src/server/stripeService.ts @klar/security @klar/engineering');
  assert(checkCodeowners(modified).some(s => s.includes('stripeService.ts') && s.includes('finance')));
});
test('removing a sensitive owner is rejected', () => {
  const modified = source.replace('/phase2_work/firestore.rules @klar/security @klar/engineering',
    '/phase2_work/firestore.rules @klar/engineering');
  assert(checkCodeowners(modified).some(s => s.includes('firestore.rules')));
});
test('a later unreviewed catchall would bypass the specialist team and is rejected', () => {
  const modified = source + '\n* @klar/engineering\n';
  assert(checkCodeowners(modified).length >= 5);
});
