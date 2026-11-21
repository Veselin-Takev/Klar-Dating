// Legacy script name maintained for callers: the retired verification flow
// must be sealed, not "age-gated"; profile IAM/adult policy is reviewed separately.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rules = readFileSync('storage.rules', 'utf8');
const engine = readFileSync('src/server/platform/storageRulesEngine.ts', 'utf8');
const client = readFileSync('src/lib/klar.ts', 'utf8');

const match = rules.match(/match \/verification\/\{uid\}\/\{datei\} \{([\s\S]*?)\n    \}/);
assert.ok(match, 'Verification Storage rules block must exist');
const block = match[1];
for (const rule of ['allow read: if false;', 'allow create, update: if false;', 'allow delete: if false;']) {
  assert.ok(block.includes(rule), 'Verification path must deny every Firebase client operation: ' + rule);
}
assert.doesNotMatch(block, /allow (?:write|create|update): if (?!false;)/, 'No permissive client writes');
assert.match(engine, /Die clientseitige Fotoverifizierung ist eingestellt/, 'Policy model must deny retired verification uploads');
assert.match(client, /Legacy gesture\/photo verification was retired/, 'Client must not depend on legacy verification uploads');
assert.match(rules, /match \/profiles\/\{uid\}\/\{datei\}/, 'Profile photo rule must remain separate');
console.log('Retired biometric photo Storage write-lockdown: PASS (static source, not active cloud rules)');
