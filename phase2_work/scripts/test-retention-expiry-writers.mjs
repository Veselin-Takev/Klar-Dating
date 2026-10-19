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
];
for (const [label,file,from,to] of cases) {
  const result=run({file,from,to});
  assert.notEqual(result.status,0, 'Missing rejection for '+label);
}
console.log('PASS: 7 expiry writer source contracts and 9 fail-closed mutations (offline only).');
