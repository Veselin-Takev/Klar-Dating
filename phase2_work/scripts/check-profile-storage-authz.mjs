// Static regression: prevent privileged profile visibility drift between
// Firebase Storage Rules and canonical Firestore age-gate source.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');
const rules = read('storage.rules');
const model = read('src/server/platform/storageRulesEngine.ts');
const age = read('src/server/platform/ageGateEngine.ts');
const firestore = read('firestore.rules');
const tests = read('tests/storageRules.spec.ts');
const profile = rules.match(/match \/profiles\/\{uid\}\/\{datei\} \{([\s\S]*?)\n    \}/);
assert.ok(profile, 'profile match must exist');
const body = profile[1];
for (const operation of [
  'allow read: if signedIn() && !istGast()',
  'allow create, update: if signedIn() && !istGast() && request.auth.uid == uid',
  'allow delete: if signedIn() && !istGast() && request.auth.uid == uid',
]) assert.ok(body.includes(operation), 'profile rule missing least-privilege operation: ' + operation);
assert.ok(body.includes('istAktiverErwachsener(request.auth.uid)')
  && body.includes('istAktiverErwachsener(uid)'), 'reader and profile owner must be checked');
assert.doesNotMatch(body, /allow read: if signedIn\(\)\s*;/, 'broad authenticated reads are unsafe');
assert.match(rules, /firestore\.get\(\/databases\/\(default\)\/documents\/users\/\$\(uid\)\)/,
  'Storage access must read server-owned Firestore adult state');
assert.match(rules, /\.data\.isAdult == true/, 'missing adult state must deny');
assert.match(rules, /\.data\.accountStatus == 'active'/, 'inactive states must deny');
assert.match(age, /isAdult: true/, 'age verification must be server authoritative');
assert.match(firestore, /!\('isAdult' in request\.resource\.data\)/,
  'client must not create adult credential fields');
assert.match(model, /requesterUserIsAdult === true/, 'policy model should use live server state');
assert.doesNotMatch(model, /request\.auth\?\.token\?\.isAdult !== true/,
  'unissued/stale token age claims must never be the policy source');
assert.match(tests, /denies profile reads when the target owner is underage or inactive/,
  'real Storage Emulator negative suite is mandatory');
console.log('Profile Storage adult-state policy drift: PASS (source only; live policy unverified)');
