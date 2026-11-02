#!/usr/bin/env node
// P0 #202 — repository-only guard; no Firebase initialization or cloud calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function legacyPhotoPurgeViolations({ legacyCron, helperSource, indexSource, modernCron, policy }) {
  const problems = [];
  if (!legacyCron.includes("legacy_verification_photo_purge_disabled")) {
    problems.push('legacy scheduled worker does not declare disabled photo purge');
  }
  // Guard against direct Storage SDK access as well as the retired wrapper.
  // This is a repository source regression check, not a proof of live cloud state.
  if (/\b(?:deleteExpiredPhotoPage|getMaintenanceBucket|getStorage)\b|\.getFiles\s*\(|\.getMetadata\s*\(|\.file\s*\(|\bfrom\s*['"`][^'"`]*(?:storage|retention)[^'"`]*['"`]|collection\s*\(\s*['"`]verification_events['"`]\s*\)/.test(legacyCron)) {
    problems.push('legacy scheduled worker can reach photo-list or photo-purge logic');
  }
  if (!legacyCron.includes("collection('funnel_events')")) {
    problems.push('unrelated funnel event cleanup was removed');
  }
  const start = helperSource.indexOf('export async function deleteExpiredPhotoPage(');
  const end = helperSource.indexOf('export async function deleteAccountPhotos(', start);
  if (start < 0 || end < start) {
    problems.push('obsolete purge API or account-erasure boundary missing');
  } else {
    const disabledHelper = helperSource.slice(start, end);
    if (!disabledHelper.includes("throw new Error('legacy_age_only_photo_purge_disabled')")) {
      problems.push('obsolete upload-age helper does not fail closed');
    }
    if (/\.getFiles\s*\(|\.delete\s*\(|\.getMetadata\s*\(/.test(disabledHelper)) {
      problems.push('obsolete upload-age helper still performs Storage access');
    }
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
  if (!policy.includes('Legacy-Pfad deaktiviert') || !policy.includes('Production NO-GO')) {
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
