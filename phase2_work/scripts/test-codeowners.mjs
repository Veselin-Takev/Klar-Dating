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

for (const pattern of [
  '/phase2_work/**',
  '**',
  '/phase2_work/src/server/*.ts',
  '/phase2_work/src/server/authorization.*',
  '/phase2_work/src/server/authorization.?s',
  '/phase2_work/src/server/[a-z]*',
]) {
  test('fail closed on GitHub glob override: ' + pattern, () => {
    const mutated = source + '\n' + pattern + ' @klar/engineering\n';
    assert(checkCodeowners(mutated).some(x => x.includes('unsupported CODEOWNERS pattern')));
  });
}

test('fail closed on ownerless CODEOWNERS rule', () => {
  assert(checkCodeowners(source + '\n/phase2_work/src/server/\n')
    .some(x => x.includes('missing CODEOWNERS reviewer identity')));
});

test('fail closed on malformed owner identity that GitHub might skip', () => {
  assert(checkCodeowners(source + '\n/phase2_work/src/server/ @\n')
    .some(x => x.includes('invalid or missing CODEOWNERS reviewer identity')));
});

for (const pattern of ['authorization.ts', 'phase2_work/src/server/authorization.ts']) {
  test('fail closed on unanchored CODEOWNERS override: ' + pattern, () => {
    const mutated = source + '\n' + pattern + ' @klar/engineering\n';
    assert(checkCodeowners(mutated).some(x => x.includes('unsupported CODEOWNERS pattern')));
  });
}

test('GitHub anchored directory without trailing slash also overrides descendants', () => {
  const mutated = source + '\n/phase2_work/src/server @klar/engineering\n';
  assert(checkCodeowners(mutated).some(e => e.includes('authorization.ts')));
});
test('directory prefix must respect path-segment boundaries', () => {
  const snippet = '* @klar/engineering\n/phase2_work/src/server @klar/security\n';
  assert.deepEqual(ownersForPath(snippet, 'phase2_work/src/serverish/authorization.ts'), ['@klar/engineering']);
  assert.deepEqual(ownersForPath(snippet, 'phase2_work/src/server/authorization.ts'), ['@klar/security']);
});

test('a file-specific engineering owner cannot replace the global default', () => {
  const modified = source.replace('* @klar/engineering', '/phase2_work/src/components/ChatView.tsx @klar/engineering');
  assert(checkCodeowners(modified).some(x => x.includes('repository-wide engineering default')));
});
test('rejects malformed team path syntax before it silently stops assigning reviewers', () => {
  const modified = source + '\n/phase2_work/src/server/ @klar/.security\n';
  assert(checkCodeowners(modified).some(x => x.includes('invalid or missing CODEOWNERS reviewer identity')));
});

test('effective owner roles for every sensitive path match the exact policy contract', () => {
  for (const [file, required] of Object.entries(requiredOwnership)) {
    for (const role of required) assert(ownersForPath(source, file).includes(role), file + ': ' + role);
  }
});
test('comments and blank lines never override a sensitive owner', () => {
  const adjusted = source + '\n\n# /phase2_work/ @klar/engineering\n   # comment-only pattern\n';
  assert.deepEqual(checkCodeowners(adjusted), []);
});
test('a later duplicate exact path rule replaces an earlier security owner', () => {
  const modified = source + '\n/phase2_work/firestore.rules @klar/engineering\n';
  assert(checkCodeowners(modified).some(e => e.includes('firestore.rules')));
});
test('invalid untrusted path input is refused rather than normalized', () => {
  for (const invalid of ['/phase2_work/firestore.rules', '../CODEOWNERS', 'phase2_work/../CODEOWNERS']) {
    assert.throws(() => ownersForPath(source, invalid), /Invalid repository-relative path/);
  }
});
