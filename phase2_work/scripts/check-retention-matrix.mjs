#!/usr/bin/env node
// P0 #70: fail closed if the approved documented TTL collection groups drift
// from the staging-only provisioning plan. This is a source-level guard,
// NOT evidence that any live Firestore policy is ACTIVE.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(resolve(project, 'scripts/configure-retention.sh'), 'utf8');
const docs = readFileSync(resolve(project, 'docs/DATA_RETENTION.md'), 'utf8');
const runbook = readFileSync(resolve(project, 'docs/PRODUCTION_RUNBOOK.md'), 'utf8');
const match = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
assert(match, 'Retention staging script must define an explicit groups=(...) matrix');
const groups = match[1].trim().split(/\s+/);
const approvedGroups = [
  'messages', 'archived_messages', 'ki_zwischenspeicher', 'age_attempts',
  'funnel_events', 'ai_budget', 'kyc_events', 'account_deletions', 'deletion_log',
  'partner_referral_click_rate_limits', 'partner_referral_webhook_rate_limits',
  'partner_referral_admin_rate_limits', 'partner_referral_user_rate_limits',
  'password_reset_rate_limits', 'verification_mail_rate_limits',
  'account_deletion_rate_limits', 'kyc_start_rate_limits', 'kyc_reconciliation_events',
  'chat_message_rate_limits', 'chat_gate_answer_rate_limits',
];
assert.deepEqual(groups, approvedGroups, 'TTL collection group matrix mismatch / unsafe drift');
assert.equal(new Set(groups).size, groups.length, 'Duplicate TTL groups are prohibited');
for (const group of groups) {
  assert(new RegExp('--collection-group=' + group + '(?![A-Za-z0-9_-])').test(docs),
    'Missing exact documented TTL group: ' + group);
}
for (const code of ['KLAR_APPLY_RETENTION', 'KLAR_ENVIRONMENT', 'KLAR_APPROVED_STAGING_PROJECT_ID',
  'KLAR_PRODUCTION_PROJECT_ID', 'KLAR_CONFIRM_RETENTION', 'KLAR_DATABASE_ID',
  'KLAR_RETENTION_LEGAL_APPROVED', 'KLAR_RETENTION_INVENTORY_APPROVED', 'KLAR_RETENTION_MATRIX_REVISION_APPROVED',
  'gcloud projects describe', '--format=\'value(labels.environment)\'']) {
  assert(script.includes(code), 'Missing safety condition: ' + code);
}
// Current operator instructions must require all 20 policies; historical
// 13-group statements remain legitimate in dated audit records below.
const operational = docs.split('## Aktivierung und Nachweis')[1]?.split('### Kündigungsnachweise')[0];
const reviewer = docs.split('### Gezielter TTL-ACTIVE-Evidenznachweis')[1]?.split('---')[0];
const reviewerLive = docs.split('## Staging TTL verification (read-only, separate from provisioning)')[1]
  ?.split('### P0 #70')[0];
const runbookOperational = runbook.split('### 2026-10-19 — Stacked P0 #70 TTL / P0 #56 Art. 17 integration')[1]
  ?.split('### 2026-10-19 — 13→20 TTL-Matrixänderung')[0];
assert(operational && reviewer && reviewerLive && runbookOperational,
  'Current retention operations/reviewer sections are missing');
assert(!/\b13\b/.test(operational) && !/\b13\b/.test(reviewer) && !/\b13\b/.test(reviewerLive)
  && !/\b13\b/.test(runbookOperational),
  'Current TTL operator instructions must not describe the superseded 13-group policy');
assert(operational.includes('alle 20 dokumentierten Collection-Groups')
  && operational.includes('aller 20 Gruppen muss')
  && reviewer.includes('20 distinct')
  && reviewerLive.includes('all 20 ACTIVE TTL fields'),
  'Current retention verification guidance must require 20 ACTIVE TTL policies');
assert(operational.includes('KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19')
  && runbook.includes('KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19')
  && runbookOperational.includes('all 20 required')
  && runbookOperational.includes('all **20** TTL policies are ACTIVE'),
  'Operational TTL instructions must retain the independent 20-group matrix approval');

assert(script.includes('DRY RUN ONLY'), 'Provisioning must default to non-mutating dry run');
assert(script.includes('--database="${KLAR_DATABASE_ID}"'), 'Must pin Firestore database explicitly');
assert(script.includes('--project="${KLAR_PROJECT_ID}"'), 'Must pin GCP project explicitly');
// A real STAGING apply must read and validate existing TTL policies *before*
// any update, not just validate the expected final ACTIVE state afterwards.
const mutationLoop = script.lastIndexOf('for group in "${groups[@]}"; do');
const listCall = script.indexOf('gcloud firestore fields ttls list --project="${KLAR_PROJECT_ID}" --database="${KLAR_DATABASE_ID}" --format=json');
const checkCall = script.indexOf('node "$repo_root/scripts/check-retention-active-evidence.mjs"');
assert(mutationLoop > 0 && listCall > 0 && checkCall > listCall && checkCall < mutationLoop,
  'Read-only scoped TTL preflight must precede any staging policy update loop');
assert(script.includes('--mode preflight-ids'), 'Preflight must return validated existing ACTIVE policy identifiers');
assert(script.includes('already_active="$(node "$repo_root/scripts/check-retention-active-evidence.mjs"'),
  'Existing ACTIVE policies must be captured from validated preflight output');
assert(script.includes('if [[ " $already_active " == *" $group "* ]]; then'),
  'Already ACTIVE policies must be skipped (idempotent staging apply)');

console.log('PASS: retention policy matrix (20 groups), docs, dry-run, staging identity and approval gates align. NO-GO pending LIVE ACTIVE verification.');
