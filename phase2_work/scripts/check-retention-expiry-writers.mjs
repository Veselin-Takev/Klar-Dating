#!/usr/bin/env node
// P0 #70: guard the 7 source-backed expiry writers newly added to the TTL matrix.
// Static source evidence only; does not attest live Firestore policies or legal approval.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const script = read('scripts/configure-retention.sh');
const match = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
assert(match, 'Missing TTL plan');
const groups = new Set(match[1].trim().split(/\s+/));
const writers = [
  ['password_reset_rate_limits', 'src/server/passwordReset.ts', 'expiresAt: new Date('],
  ['verification_mail_rate_limits', 'src/server/email.ts', 'expiresAt: new Date('],
  ['account_deletion_rate_limits', 'src/server/routes/account.ts', 'expiresAt: new Date('],
  ['kyc_start_rate_limits', 'src/server/verification/diditKyc.ts', 'expiresAt: new Date('],
  ['kyc_reconciliation_events', 'src/server/verification/diditKyc.ts', 'expiresAt: new Date('],
  ['chat_message_rate_limits', 'src/server/routes/chat.ts', 'distributedRateLimit({'],
  ['chat_gate_answer_rate_limits', 'src/server/routes/chat.ts', 'distributedRateLimit({'],
];
for (const [group, file, marker] of writers) {
  assert(groups.has(group), 'Expiry-writing collection missing from TTL plan: ' + group);
  const code = read(file);
  assert(code.includes("'" + group + "'") || code.includes(group + "/${claimed}"),
    'Actual TTL writer group missing: ' + group);
  assert(code.includes(marker), 'Expected expiry writer pattern missing: ' + group);
}
const chat = read('src/server/routes/chat.ts');
assert(chat.includes('collection: CHAT_MESSAGE_RATE_LIMIT_COLLECTION')
  && chat.includes('collection: CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION'),
  'Both chat limiters must use the distributed expiry writer');
// A filename-level `expiresAt` check is not sufficient when one module writes
// multiple documents. Demand a Date on BOTH creation and counter-update paths
// for every scoped limiter, and on the exact KYC reconciliation write.
const writeWithDate = /expiresAt\s*:\s*new Date\s*\(/;
function findDocumentWrite(moduleCode, operation, label) {
  const match = new RegExp('\\btx\\.' + operation + '\\(ref,\\s*\\{([^}]+)\\}', 'g');
  const bodies = [...moduleCode.matchAll(match)].map(hit => hit[1]);
  assert.equal(bodies.length, 1, `${label}: expected one transaction ${operation} write`);
  assert(writeWithDate.test(bodies[0]), `${label}: transaction ${operation} must write expiresAt as Date`);
}
for (const [label, file, begin] of [
  ['password_reset_rate_limits', 'src/server/passwordReset.ts', 'const ACCOUNT_RATE_LIMIT_COLLECTION'],
  ['verification_mail_rate_limits', 'src/server/email.ts', 'const VERIFICATION_RATE_LIMIT_COLLECTION'],
  ['account_deletion_rate_limits', 'src/server/routes/account.ts', "collection('account_deletion_rate_limits')"],
  ['kyc_start_rate_limits', 'src/server/verification/diditKyc.ts', 'const KYC_START_RATE_LIMIT_COLLECTION'],
]) {
  const code = read(file);
  const start = code.indexOf(begin);
  assert(start >= 0, `${label}: transaction section missing`);
  // One bounded function block avoids accepting an unrelated write elsewhere.
  let section = code.slice(start, start + 3800);
  if (label === 'account_deletion_rate_limits') section = code.slice(Math.max(0, start - 600), start + 2200);
  findDocumentWrite(section, 'set', label);
  findDocumentWrite(section, 'update', label);
}
const limiter = read('src/server/distributedRateLimiter.ts');
findDocumentWrite(limiter, 'set', 'shared_chat_distributed_rate_limit');
findDocumentWrite(limiter, 'update', 'shared_chat_distributed_rate_limit');
const kyc = read('src/server/verification/diditKyc.ts');
const reconciliation = kyc.match(/tx\.set\(db\.doc\(`kyc_reconciliation_events\/\$\{claimed\}`\),\s*\{([^}]+)\}/);
assert(reconciliation, 'KYC reconciliation write missing');
assert(writeWithDate.test(reconciliation[1]), 'KYC reconciliation must write expiresAt as Date');
console.log('PASS: 7 previously untracked expiry-writing Firestore collection groups are covered by 20-group TTL plan (source-only).');
