import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export function verifyStorageAgeGate(rules, engine) {
  assert.match(rules,
    /function volljaehrigesProfil\(uid\)\s*\{\s*return firestore\.get\(\/databases\/\(default\)\/documents\/users\/\$\(uid\)\)\.data\.isAdult == true;\s*\}/,
    'Storage must check server-owned Firestore users/{uid}.isAdult, not client claims');
  assert.match(rules,
    /function istVolljaehrig\(\)\s*\{\s*return signedIn\(\) && !istGast\(\) && volljaehrigesProfil\(request\.auth\.uid\);\s*\}/,
    'Requester age and anonymous gate must use authoritative profile');
  // Catch a second permissive read rule: Firebase rules OR overlapping grants.
  const readRules = [...rules.matchAll(/\ballow\s+read\s*:\s*if\s*([^;]+);/g)].map(match => match[1].trim());
  assert.deepEqual(readRules,
    ['false', 'istVolljaehrig() && volljaehrigesProfil(uid)'],
    'Exactly two read rules: verification denied and profiles adult+adult');
  assert.match(rules,
    /match \/verification\/\{uid\}\/\{datei\}[\s\S]*?allow create, update: if istVolljaehrig\(\) && request\.auth\.uid == uid/,
    'Verification uploads need adult and own-path gate');
  assert.match(rules,
    /match \/profiles\/\{uid\}\/\{datei\}[\s\S]*?allow create, update: if istVolljaehrig\(\) && request\.auth\.uid == uid/,
    'Profile uploads need adult and own-path gate');
  assert.match(rules, /allow delete: if istVolljaehrig\(\) && request\.auth\.uid == uid;/,
    'Profile deletes require adult owner');
  assert(!rules.includes('request.auth.token.isAdult'),
    'Unverified or stale JWT age claim must not bypass Firestore');
  assert(engine.includes('requesterUserIsAdult?: boolean;')
    && engine.includes('targetUserIsAdult?: boolean;'),
  'Pure model requires server-resolved adult state for reader and profile');
  assert(!engine.includes('request.auth?.token?.isAdult'),
    'Pure model must not trust a token age claim');
  assert((engine.match(/request\.requesterUserIsAdult !== true/g) ?? []).length === 4,
    'All four adult read/write/delete model checks must fail closed');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyStorageAgeGate(
    fs.readFileSync('storage.rules', 'utf8'),
    fs.readFileSync('src/server/platform/storageRulesEngine.ts', 'utf8'),
  );
  console.log('PASS Storage adult gates: 2-doc Firestore authorization, strict profile/verification read/write/delete source alignment');
}
