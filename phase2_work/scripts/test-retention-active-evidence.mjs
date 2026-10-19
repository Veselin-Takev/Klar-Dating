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
const run = (records, mode = null) => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-ttl-evidence-'));
  try {
    const path = join(dir, 'ttls.json');
    writeFileSync(path, JSON.stringify(records));
    return spawnSync(process.execPath, [script, '--evidence', path, '--project', project, '--database', database, ...(mode ? ['--mode', mode] : [])], { encoding: 'utf8', timeout: 10000 });
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
  ['unapproved ACTIVE TTL group', [...valid, { name: 'projects/' + project + '/databases/' + database + '/collectionGroups/undocumented_retention/fields/expiresAt', ttlConfig: { state: 'ACTIVE' } }]],
  ['unapproved CREATING TTL group', [...valid, { name: 'projects/' + project + '/databases/' + database + '/collectionGroups/undocumented_retention/fields/expiresAt', ttlConfig: { state: 'CREATING' } }]],
  ['unapproved alternate field TTL group', [...valid, { name: 'projects/' + project + '/databases/' + database + '/collectionGroups/undocumented_retention/fields/autoDeleteAt', ttlConfig: { state: 'ACTIVE' } }]],
];
for (const [label, record] of mutations) {
  const outcome = run(record);
  assert.notEqual(outcome.status, 0, 'Failed to reject ' + label);
}
console.log('PASS: read-only TTL evidence validator accepts 20 scoped ACTIVE fields and rejects ' + mutations.length + ' mutations');

// Preflight must accept a genuinely unconfigured staging database or any
// previously-approved ACTIVE subset, but must reject risky existing policies
// before the staging provisioner issues any writes.
for (const safe of [[], valid.slice(0, 2), valid]) {
  const preflight = run(safe, 'preflight');
  assert.equal(preflight.status, 0, 'Valid preflight subset rejected: ' + preflight.stderr);
}
const preflightMutations = [
  ['unapproved policy', [...valid.slice(0, 2), { name: 'projects/' + project + '/databases/' + database + '/collectionGroups/unknown_group/fields/expiresAt', ttlConfig: { state: 'ACTIVE' } }]],
  ['wrong TTL field', [ { ...valid[0], name: valid[0].name.replace('expiresAt', 'deleteAt') } ]],
  ['nonzero offset', [{ ...valid[0], ttlConfig: { state: 'ACTIVE', expirationOffset: '3600s' } }]],
  ['still creating policy', [{ ...valid[0], ttlConfig: { state: 'CREATING' } }]],
  ['duplicate policy', [valid[0], valid[0]]],
  ['different project', [{ ...valid[0], name: valid[0].name.replace(project, 'another-project') }]],
  ['missing state', [{ ...valid[0], ttlConfig: {} }]],
];
for (const [label, fixture] of preflightMutations) {
  const result = run(fixture, 'preflight');
  assert.notEqual(result.status, 0, 'Preflight accepted ' + label);
}
const incorrectMode = run([], 'unsafe');
assert.notEqual(incorrectMode.status, 0, 'Unknown preflight mode must be rejected');
console.log('PASS: empty/existing ACTIVE subsets accepted and ' + preflightMutations.length + ' dangerous policy preflight mutations rejected.');
