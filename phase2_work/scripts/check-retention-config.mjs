#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const script = readFileSync('scripts/configure-retention.sh', 'utf8');
const docs = readFileSync('docs/DATA_RETENTION.md', 'utf8');
const messageWriter = readFileSync('src/server/messages.ts', 'utf8');
const archiveWorker = readFileSync('functions/src/archiveInactiveChats.ts', 'utf8');
const kycWriter = readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const photoCron = readFileSync('functions/src/deleteExpiredPhotos.ts', 'utf8');
const photoPurgeCron = readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const photoPurgeApi = readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const retiredPhotoHelper = readFileSync('functions/src/retention.ts', 'utf8');
const required = ['messages', 'archived_messages', 'ki_zwischenspeicher', 'age_attempts', 'kyc_events', 'deletion_log', 'funnel_events', 'ai_budget', 'account_deletions'];
const loop = script.match(/for collection_group in ([^;]+); do/);
const configured = new Set((loop?.[1] ?? '').trim().split(/\s+/).filter(Boolean));
const missingScript = required.filter(x => !configured.has(x));
const missingDocs = required.filter(x => !docs.includes(`/${x}`));
const sourceViolations = [];
if (!messageWriter.includes('expiresAt: new Date(Date.now() + 90 * 86400_000)')) sourceViolations.push('messages writer does not set the 90-day expiresAt');
if (!archiveWorker.includes("collection('archived_messages')") || !archiveWorker.includes('...message.data()')) sourceViolations.push('archival does not preserve the message expiresAt');
if (!kycWriter.includes("kyc_events/${event.event_id}") || !kycWriter.includes('expiresAt: new Date(now + 30 * 86400_000)')) sourceViolations.push('kyc_events writer does not set the 30-day expiresAt');
if (!photoPurgeCron.includes('/api/admin/purge-verification-storage') ||
    !photoPurgeApi.includes("collection('verification_events')") ||
    !photoPurgeApi.includes("where('fotoLoeschenAb', '<=', new Date(now))") ||
    !photoPurgeApi.includes('executeVerificationRetentionBatch')) {
  sourceViolations.push('verification photo retention must follow decision-aware server route');
}
if (photoCron.includes('deleteExpiredPhotoPage') ||
    photoCron.includes('getMaintenanceBucket') ||
    photoCron.includes("prefix: 'verification/'") ||
    !retiredPhotoHelper.includes("throw new Error('legacy_photo_age_retention_disabled')")) {
  sourceViolations.push('legacy verification photo age-based purge must remain fail-closed');
}
if (missingScript.length || missingDocs.length || sourceViolations.length) {
  console.error('FAIL retention config:', { missingScript, missingDocs, sourceViolations });
  process.exit(1);
}
if (!script.includes('KLAR_CONFIRM_RETENTION') || !script.includes('set -euo pipefail')) {
  console.error('FAIL retention confirmation guard'); process.exit(1);
}
console.log(`PASS retention config (${required.length} collection groups; writers verified)`);
