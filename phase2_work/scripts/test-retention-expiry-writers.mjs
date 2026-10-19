#!/usr/bin/env node
// Negative regression tests without Firebase credentials or cloud access.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/configure-retention.sh', 'scripts/check-retention-expiry-writers.mjs',
  'src/server/passwordReset.ts', 'src/server/email.ts', 'src/server/routes/account.ts',
  'src/server/verification/diditKyc.ts', 'src/server/routes/chat.ts',
  'src/server/distributedRateLimiter.ts',
];
const originals = new Map(paths.map(file => [file, readFileSync(join(root, file), 'utf8')]));
function run(change) {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-ttl-writer-check-'));
  try {
    for (const [file, original] of originals) {
      const target = join(tmp, file); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, change?.file === file ? original.replaceAll(change.from, change.to) : original);
    }
    if (change) assert.notEqual(originals.get(change.file), readFileSync(join(tmp,change.file),'utf8'), 'Mutation was not applied');
    return spawnSync(process.execPath, [join(tmp, 'scripts/check-retention-expiry-writers.mjs')],
      { encoding: 'utf8', timeout: 15000 });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
let ok = run(); assert.equal(ok.status,0,ok.stderr);
const cases = [
  ['passwordReset group', 'src/server/passwordReset.ts', "'password_reset_rate_limits'", "'untracked_reset_limits'"],
  ['email group', 'src/server/email.ts', "'verification_mail_rate_limits'", "'untracked_mail_limits'"],
  ['account deletion group', 'src/server/routes/account.ts', "'account_deletion_rate_limits'", "'untracked_account_limits'"],
  ['KYC start group', 'src/server/verification/diditKyc.ts', "'kyc_start_rate_limits'", "'untracked_kyc_limits'"],
  ['KYC reconciliation group', 'src/server/verification/diditKyc.ts', 'kyc_reconciliation_events/${claimed}', 'untracked_reconciliation/${claimed}'],
  ['chat message group', 'src/server/routes/chat.ts', "'chat_message_rate_limits'", "'unknown_message_limits'"],
  ['chat gate group', 'src/server/routes/chat.ts', "'chat_gate_answer_rate_limits'", "'unknown_gate_limits'"],
  ['shared expiry writer', 'src/server/distributedRateLimiter.ts', 'expiresAt: new Date(', 'obsoleteAt: new Date('],
  ['TTL plan group', 'scripts/configure-retention.sh', 'password_reset_rate_limits ', 'untracked_reset_limits '],

  // Removal of a single expiresAt in either write branch must fail even when
  // the other branch (and other modules) still writes expiresAt.
  ['password reset create expiration removed', 'src/server/passwordReset.ts', 'expiresAt: new Date(now + ACCOUNT_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(now + ACCOUNT_RATE_LIMIT_WINDOW_MS)'],
  ['password reset update expiration removed', 'src/server/passwordReset.ts', 'expiresAt: new Date(windowStartedAt + ACCOUNT_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(windowStartedAt + ACCOUNT_RATE_LIMIT_WINDOW_MS)'],
  ['verification mail create expiration removed', 'src/server/email.ts', 'expiresAt: new Date(now + VERIFICATION_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(now + VERIFICATION_RATE_LIMIT_WINDOW_MS)'],
  ['verification mail update expiration removed', 'src/server/email.ts', 'expiresAt: new Date(windowStartedAt + VERIFICATION_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(windowStartedAt + VERIFICATION_RATE_LIMIT_WINDOW_MS)'],
  ['account deletion limiter create expiration removed', 'src/server/routes/account.ts', 'expiresAt: new Date(now + windowMs)', 'retiredAt: new Date(now + windowMs)'],
  ['account deletion limiter update expiration removed', 'src/server/routes/account.ts', 'expiresAt: new Date(windowStartedAt + windowMs)', 'retiredAt: new Date(windowStartedAt + windowMs)'],
  ['KYC start create expiration removed', 'src/server/verification/diditKyc.ts', 'expiresAt: new Date(now + KYC_START_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(now + KYC_START_RATE_LIMIT_WINDOW_MS)'],
  ['KYC start update expiration removed', 'src/server/verification/diditKyc.ts', 'expiresAt: new Date(windowStartedAt + KYC_START_RATE_LIMIT_WINDOW_MS)', 'retiredAt: new Date(windowStartedAt + KYC_START_RATE_LIMIT_WINDOW_MS)'],
  ['KYC reconciliation expiration removed', 'src/server/verification/diditKyc.ts', 'reconciledAt: new Date(now), expiresAt: new Date(now + 30 * 86400_000)', 'reconciledAt: new Date(now), retiredAt: new Date(now + 30 * 86400_000)'],
  ['chat limiter create expiration removed', 'src/server/distributedRateLimiter.ts', 'expiresAt: new Date(now + options.windowMs)', 'retiredAt: new Date(now + options.windowMs)'],
  ['chat limiter update expiration removed', 'src/server/distributedRateLimiter.ts', 'expiresAt: new Date(start + options.windowMs)', 'retiredAt: new Date(start + options.windowMs)'],
];
for (const [label,file,from,to] of cases) {
  const result=run({file,from,to});
  assert.notEqual(result.status,0, 'Missing rejection for '+label);
}
console.log('PASS: 7 expiry writer source contracts and ' + cases.length + ' fail-closed mutations (offline only).');
