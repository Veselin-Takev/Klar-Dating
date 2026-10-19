#!/usr/bin/env node
// No real cloud access: test saved evidence only, including fail-closed mutations.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-retention-active-evidence.mjs', import.meta.url));
const project = 'klar-staging-123', database = '(default)';
const groups = [
  'messages', 'archived_messages', 'ki_zwischenspeicher', 'age_attempts',
  'funnel_events', 'ai_budget', 'kyc_events', 'account_deletions', 'deletion_log',
  'partner_referral_click_rate_limits', 'partner_referral_webhook_rate_limits',
  'partner_referral_admin_rate_limits', 'partner_referral_user_rate_limits',
  'password_reset_rate_limits', 'verification_mail_rate_limits',
  'account_deletion_rate_limits', 'kyc_start_rate_limits', 'kyc_reconciliation_events',
  'chat_message_rate_limits', 'chat_gate_answer_rate_limits',
];
const valid = groups.map(group => ({
  name: 'projects/' + project + '/databases/' + database + '/collectionGroups/' + group + '/fields/expiresAt',
  ttlConfig: { state: 'ACTIVE' },
}));
const run = records => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-ttl-evidence-'));
  try {
    const path = join(dir, 'ttls.json');
    writeFileSync(path, JSON.stringify(records));
    return spawnSync(process.execPath, [script, '--evidence', path, '--project', project, '--database', database], { encoding: 'utf8', timeout: 10000 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const ok = run(valid);
assert.equal(ok.status, 0, ok.stderr);
const mutations = [
  ['missing group', valid.slice(1)],
  ['duplicate', [...valid, valid[0]]],
  ['CREATING', valid.map((x, i) => i === 0 ? { ...x, ttlConfig: { state: 'CREATING' } } : x)],
  ['wrong field', valid.map((x, i) => i === 0 ? { ...x, name: x.name.replace('/expiresAt', '/otherField') } : x)],
  ['other project', valid.map((x, i) => i === 0 ? { ...x, name: x.name.replace(project, 'other-project-123') } : x)],
  ['other database', valid.map((x, i) => i === 0 ? { ...x, name: x.name.replace(database, 'other_db') } : x)],
  ['offset', valid.map((x, i) => i === 0 ? { ...x, ttlConfig: { state: 'ACTIVE', expirationOffset: '3600s' } } : x)],
  ['missing status', valid.map((x, i) => i === 0 ? { ...x, ttlConfig: {} } : x)],
  ['corrupt name', valid.map((x, i) => i === 0 ? { ...x, name: 'not-a-resource-name' } : x)],
];
for (const [label, record] of mutations) {
  const outcome = run(record);
  assert.notEqual(outcome.status, 0, 'Failed to reject ' + label);
}
console.log('PASS: read-only TTL evidence validator accepts 20 scoped ACTIVE fields and rejects ' + mutations.length + ' mutations');
