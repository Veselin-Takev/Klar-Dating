import fs from 'node:fs';

const rules = fs.readFileSync('storage.rules', 'utf8');
const engine = fs.readFileSync('src/server/platform/storageRulesEngine.ts', 'utf8');
const required = [
  'function istVolljaehrig()',
  'firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.isAdult == true',
  'allow read: if istVolljaehrig();',
  'allow create, update: if istVolljaehrig() && request.auth.uid == uid',
];
for (const needle of required) {
  if (!rules.includes(needle)) throw new Error(`storage.rules missing age-gate invariant: ${needle}`);
}
if (!/match \/verification\/\{uid\}\/\{datei\}[\s\S]*allow create, update: if istVolljaehrig\(\)/.test(rules)) {
  throw new Error('verification uploads are not bound to the adult gate');
}
if (!/match \/profiles\/\{uid\}\/\{datei\}[\s\S]*allow read: if istVolljaehrig\(\);/.test(rules)) {
  throw new Error('profile reads are not bound to the adult gate');
}
for (const needle of ['isAdult?: boolean', 'Altersfreigabe erforderlich.']) {
  if (!engine.includes(needle)) throw new Error(`storageRulesEngine missing age-gate invariant: ${needle}`);
}
console.log('Storage age-gate invariants: PASS');
