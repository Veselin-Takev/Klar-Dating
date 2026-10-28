#!/usr/bin/env node
import { readFileSync } from 'node:fs';
// Reuse the canonical 20-group policy gate; do not independently parse a stale Bash loop.
import './check-retention-matrix.mjs';
const script = readFileSync('scripts/configure-retention.sh', 'utf8');
const docs = readFileSync('docs/DATA_RETENTION.md', 'utf8');
const messageWriter = readFileSync('src/server/messages.ts', 'utf8');
const archiveWorker = readFileSync('functions/src/archiveInactiveChats.ts', 'utf8');
const kycWriter = readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const functionExports = readFileSync('functions/src/index.ts', 'utf8');
const decisionPurge = readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const safeCron = readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const required = ['messages', 'archived_messages', 'ki_zwischenspeicher', 'age_attempts', 'kyc_events', 'deletion_log', 'funnel_events', 'ai_budget', 'account_deletions'];
const matrix = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
if (!matrix) throw new Error('Missing explicit retention collection-group matrix');
const groups = matrix[1].trim().split(/\s+/).filter(Boolean);
const configured = new Set(groups);
if (groups.length !== configured.size) throw new Error('Duplicate retention collection-group entries');
const missingScript = required.filter(x => !configured.has(x));
const missingDocs = required.filter(x => !docs.includes(`/${x}`));
export function photoPurgeExportViolations(exportsSource, cronSource) {
  const failures = [];
  const active = exportsSource.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('//'));
  if (!active.includes("export { purgeVerificationStorageCron } from './purgeVerificationStorage';")
    || !cronSource.includes('COMPLIANCE_JOB_SECRET')) failures.push('authenticated verification purge scheduler missing');
  if (active.some(line => /^export\s+\{\s*deleteExpiredPhotosCron\s*\}\s+from\s+['"]\.\/deleteExpiredPhotos['"]\s*;?$/.test(line)))
    failures.push('unsafe legacy creation-age scheduler must not be deployed');
  return failures;
}
const sourceViolations = [];
if (!messageWriter.includes('expiresAt: new Date(Date.now() + 90 * 86400_000)')) sourceViolations.push('messages writer does not set the 90-day expiresAt');
if (!archiveWorker.includes("collection('archived_messages')") || !archiveWorker.includes('...message.data()')) sourceViolations.push('archival does not preserve the message expiresAt');
if (!kycWriter.includes("kyc_events/${event.event_id}") || !kycWriter.includes('expiresAt: new Date(now + 30 * 86400_000)')) sourceViolations.push('kyc_events writer does not set the 30-day expiresAt');
if (!decisionPurge.includes("collection('verification_events')")
  || !decisionPurge.includes(".where('fotoLoeschenAb', '<=', new Date(now))")
  || !decisionPurge.includes('executeVerificationRetentionBatch')
  || !decisionPurge.includes('storagePath')) sourceViolations.push('decision-based verification photo purge missing');
sourceViolations.push(...photoPurgeExportViolations(functionExports, safeCron));
if (missingScript.length || missingDocs.length || sourceViolations.length) {
  console.error('FAIL retention config:', { missingScript, missingDocs, sourceViolations });
  process.exit(1);
}
if (!script.includes('KLAR_CONFIRM_RETENTION') || !script.includes('set -euo pipefail')) {
  console.error('FAIL retention confirmation guard'); process.exit(1);
}
console.log(`PASS retention config (${required.length} collection groups; writers verified)`);
