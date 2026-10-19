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
const limiter = read('src/server/distributedRateLimiter.ts');
assert(limiter.includes('expiresAt: new Date('), 'Distributed rate-limit expiry timestamp missing');
const kyc = read('src/server/verification/diditKyc.ts');
assert(/kyc_reconciliation_events\/\$\{claimed\}[\s\S]{0,320}expiresAt:/.test(kyc),
  'KYC reconciliation expiry field missing from the actual write');
console.log('PASS: 7 previously untracked expiry-writing Firestore collection groups are covered by 20-group TTL plan (source-only).');
