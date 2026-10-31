import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyStorageAgeGate } from './check-storage-age-gate.mjs';

const rules = readFileSync('storage.rules', 'utf8');
const engine = readFileSync('src/server/platform/storageRulesEngine.ts', 'utf8');

test('real Storage source and pure model have two authoritative adult gates', () => {
  assert.doesNotThrow(() => verifyStorageAgeGate(rules, engine));
});

const mutations = [
  ['adult target no longer checked', rules.replace('allow read: if istVolljaehrig() && volljaehrigesProfil(uid);',
    'allow read: if istVolljaehrig();')],
  ['requester adult no longer checked', rules.replace(
    'return signedIn() && !istGast() && volljaehrigesProfil(request.auth.uid);',
    'return signedIn() && !istGast();')],
  ['permissive second read introduced', rules.replace(
    'allow read: if istVolljaehrig() && volljaehrigesProfil(uid);',
    'allow read: if istVolljaehrig() && volljaehrigesProfil(uid);\n      allow read: if signedIn();')],
  ['adult upload removed', rules.replace(
    'allow create, update: if istVolljaehrig() && request.auth.uid == uid',
    'allow create, update: if signedIn() && request.auth.uid == uid')],
  ['adult delete removed', rules.replace(
    'allow delete: if istVolljaehrig() && request.auth.uid == uid;',
    'allow delete: if signedIn() && request.auth.uid == uid;')],
  ['client JWT replaces server-owned adult', rules.replace(
    'return firestore.get(/databases/(default)/documents/users/$(uid)).data.isAdult == true;',
    'return request.auth.token.isAdult == true;')],
  ['unknown-age client model becomes allowed', rules],
];

for (const [name, modified] of mutations) {
  test('fail closed when: ' + name, () => {
    if (name === 'unknown-age client model becomes allowed') {
      const mutatedEngine = engine.replace('request.requesterUserIsAdult !== true',
        'request.requesterUserIsAdult === false');
      assert.notEqual(mutatedEngine, engine);
      assert.throws(() => verifyStorageAgeGate(rules, mutatedEngine));
    } else {
      assert.notEqual(modified, rules, 'mutation must target actual source');
      assert.throws(() => verifyStorageAgeGate(modified, engine));
    }
  });
}
