#!/usr/bin/env node
// P0 #202 — repository-only guard; no Firebase initialization or cloud calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function legacyPhotoPurgeViolations({ legacyCron, helperSource, indexSource, modernCron, policy }) {
  const problems = [];
  if (!(legacyCron.includes("legacy_verification_photo_purge_disabled") || legacyCron.includes("disabled_in_legacy_cron"))) {
    problems.push('legacy scheduled worker does not declare disabled photo purge');
  }
  // Guard against direct Storage SDK access as well as the retired wrapper.
  // This is a repository source regression check, not a proof of live cloud state.
  if (/\b(?:deleteExpiredPhotoPage|getMaintenanceBucket|getStorage)\b|\.getFiles\s*\(|\.deleteFiles\s*\(|\.getMetadata\s*\(|\.file\s*\(|\bfrom\s*['"`][^'"`]*(?:storage|retention)[^'"`]*['"`]|collection\s*\(\s*['"`]verification_events['"`]\s*\)/.test(legacyCron)) {
    problems.push('legacy scheduled worker can reach photo-list or photo-purge logic');
  }
  // Allow only the existing Firestore funnel-event batch deletion; reject other direct deletes.
  const withoutFunnelBatchDelete = legacyCron.replaceAll('batch.delete(doc.ref)', '');
  if (/\.delete\s*\(/.test(withoutFunnelBatchDelete)) {
    problems.push('legacy scheduled worker contains an unapproved direct delete call');
  }
  if (!legacyCron.includes("collection('funnel_events')")) {
    problems.push('unrelated funnel event cleanup was removed');
  }
  // The integrated baseline permanently removes the upload-age helper.
  // Reject any reintroduction, even a nominal throwing shim: a future caller
  // must not be able to restore this unsafe API without explicit review.
  if (/\b(?:export\s+)?(?:async\s+)?function\s+deleteExpiredPhotoPage\s*\(|\b(?:const|let|var)\s+deleteExpiredPhotoPage\b/.test(helperSource)) {
    problems.push('retired upload-age purge helper reintroduced');
  }
  if (!helperSource.includes('export async function deleteAccountPhotos(')) {
    problems.push('account-erasure boundary missing');
  }
  if (!indexSource.includes("export { deleteExpiredPhotosCron } from './deleteExpiredPhotos';")) {
    problems.push('legacy function name was unexpectedly removed; deployed Scheduler migration unreviewed');
  }
  if (!indexSource.includes("export { purgeVerificationStorageCron } from './purgeVerificationStorage';")) {
    problems.push('decision-aware scheduled entrypoint not exported');
  }
  if (!modernCron.includes('/api/admin/purge-verification-storage') || !modernCron.includes('COMPLIANCE_JOB_SECRET')) {
    problems.push('decision-aware signed purge integration missing');
  }
  if (!policy.includes('**Legacy-Cron:**') || !policy.includes('deaktiviert nur diesen Upload-Alter-Löschpfad') || !policy.includes('productionApproved=false')) {
    problems.push('retention policy has not been corrected or retains a misleading GO claim');
  }
  return problems;
}

const ownFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === ownFile) {
  const root = resolve(dirname(ownFile), '..');
  const load = path => readFileSync(resolve(root, path), 'utf8');
  const violations = legacyPhotoPurgeViolations({
    legacyCron: load('functions/src/deleteExpiredPhotos.ts'),
    helperSource: load('functions/src/retention.ts'),
    indexSource: load('functions/src/index.ts'),
    modernCron: load('functions/src/purgeVerificationStorage.ts'),
    policy: load('docs/DATA_RETENTION.md'),
  });
  assert.deepEqual(violations, [], 'P0 #202 legacy purge source regression: ' + violations.join('; '));
  console.log('PASS: P0 #202 legacy photo purge fails closed; funnel cleanup and decision-aware scheduler remain');
}
