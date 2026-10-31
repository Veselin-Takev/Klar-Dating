#!/usr/bin/env node
// P0 #202: read-only repo-source verification; NOT evidence of deployed TTL,
// Cloud Scheduler, IAM, GCS holds, or a completed privacy/legal review.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');

export function assertRetentionConfiguration({
  script, docs, messageWriter, archiveWorker, kycWriter,
  legacyCron, signedCron, functionsIndex, route, engine,
}) {
  const match = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
  assert(match, 'Staging-only retention script must declare a groups=(...) matrix');
  const groups = match[1].trim().split(/\s+/);
  assert.equal(groups.length, 20, '20 approved retention TTL groups required');
  assert.equal(new Set(groups).size, groups.length, 'Duplicate retention TTL group');
  for (const group of groups) {
    assert(new RegExp('--collection-group=' + group + '(?![A-Za-z0-9_-])').test(docs),
      'Documented TTL group missing: ' + group);
  }
  for (const token of ['set -euo pipefail', 'KLAR_CONFIRM_RETENTION',
    'KLAR_APPLY_RETENTION', 'KLAR_ENVIRONMENT', 'KLAR_RETENTION_LEGAL_APPROVED',
    'KLAR_RETENTION_INVENTORY_APPROVED', 'KLAR_PRODUCTION_PROJECT_ID']) {
    assert(script.includes(token), 'Missing fail-closed TTL staging approval: ' + token);
  }
  assert(script.includes('DRY RUN ONLY'), 'TTL plan must default to non-mutating dry run');

  assert(messageWriter.includes('expiresAt: new Date(Date.now() + 90 * 86400_000)'),
    'Chat message writer must set the 90-day TTL');
  assert(archiveWorker.includes("collection('archived_messages')") &&
    archiveWorker.includes('...message.data()'),
    'Archival must preserve the original message expiry');
  assert(kycWriter.includes("kyc_events/${event.event_id}") &&
    kycWriter.includes('expiresAt: new Date(now + 30 * 86400_000)'),
    'Didit deduplication event writer must set a 30-day TTL');

  // Legacy entrypoint remains for controlled deployed-Scheduler migration but
  // must never delete biometrics by the GCS timeCreated/upload timestamp.
  assert.match(legacyCron, /export const deleteExpiredPhotosCron\b/,
    'Retain legacy exported cron for explicit migration');
  assert.match(legacyCron, /collection\('funnel_events'\)/,
    'Legacy cron may only clean nonbiometric expired funnel events');
  assert.doesNotMatch(legacyCron,
    /\bgetMaintenanceBucket\b|\bdeleteExpiredPhotoPage\b|\.getFiles\s*\(|\bfile\.delete\s*\(/,
    'Legacy upload-age biometric Storage delete must remain disabled');

  // Decision-aware photo erasure lives in the *separate* signed scheduler,
  // route and retention engine; never require it in the legacy funnel cron.
  assert.match(functionsIndex, /export \{ deleteExpiredPhotosCron \}/,
    'Legacy entrypoint must be auditable');
  assert.match(functionsIndex, /export \{ purgeVerificationStorageCron \}/,
    'Signed decision-aware photo purge scheduler must remain registered');
  assert.match(signedCron, /createHmac\('sha256'/,
    'Photo purge scheduler must sign its requests');
  assert.match(signedCron, /\/api\/admin\/purge-verification-storage/,
    'Photo purge scheduler must call signed compliance API');
  assert.match(route, /validComplianceRequest\(/,
    'Compliance endpoint must verify its signature');
  assert.match(route, /\.where\('fotoLoeschenAb', '<=', new Date\(now\)\)/,
    'Photo deletion must select records by decision-based due date');
  assert.match(route, /scanPurgePages\(/,
    'Decision-based purge must use bounded, resumable scanner');
  assert.match(route, /ifGenerationMatch/,
    'Storage deletion must retain generation preconditions');
  assert.match(engine, /artifact\.status !== 'approved' && artifact\.status !== 'rejected'/,
    'Every nonfinal moderation status must block photo deletion');
  assert.match(engine, /isVerificationArtifactExpired\(artifact\.decidedAt/,
    'Retention expiry must use the moderation decision, not upload time');
  assert.match(docs, /30 Tage nach einer serverseitig dokumentierten Moderationsentscheidung/,
    'Document storage retention origin as moderation decision');
}

export function verifyRetentionConfiguration() {
  assertRetentionConfiguration({
    script: read('scripts/configure-retention.sh'),
    docs: read('docs/DATA_RETENTION.md'),
    messageWriter: read('src/server/messages.ts'),
    archiveWorker: read('functions/src/archiveInactiveChats.ts'),
    kycWriter: read('src/server/verification/diditKyc.ts'),
    legacyCron: read('functions/src/deleteExpiredPhotos.ts'),
    signedCron: read('functions/src/purgeVerificationStorage.ts'),
    functionsIndex: read('functions/src/index.ts'),
    route: read('src/server/routes/complianceStorage.ts'),
    engine: read('src/server/platform/storageRetentionEngine.ts'),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyRetentionConfiguration();
  console.log('PASS retention config: 20 TTL groups, staging-only provision, decision-bound signed photo purge. Source only.');
}
