#!/usr/bin/env node
// A-01/A-08 source guard: 20-group matrix and no age-only verification photo purge.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const script = readFileSync('scripts/configure-retention.sh', 'utf8');
const docs = readFileSync('docs/DATA_RETENTION.md', 'utf8');
const messageWriter = readFileSync('src/server/messages.ts', 'utf8');
const archiveWorker = readFileSync('functions/src/archiveInactiveChats.ts', 'utf8');
const kycWriter = readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const photoCron = readFileSync('functions/src/deleteExpiredPhotos.ts', 'utf8');
const photoApi = readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const signedScheduler = readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const legacyStorage = readFileSync('functions/src/retention.ts', 'utf8');
const matrix = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
assert(matrix, 'Explicit TTL matrix absent');
const groups = matrix[1].trim().split(/\s+/);
assert.equal(groups.length, 20, 'Expected 20 candidate TTL groups');
for (const group of groups) assert(docs.includes('--collection-group=' + group), 'Undocumented TTL group: ' + group);
assert(messageWriter.includes('expiresAt: new Date(Date.now() + 90 * 86400_000)'), 'Message TTL writer');
assert(archiveWorker.includes("collection('archived_messages')") && archiveWorker.includes('...message.data()'), 'Archive TTL writer');
assert(kycWriter.includes('kyc_events/') && kycWriter.includes('expiresAt: new Date(now + 30 * 86400_000)'), 'KYC TTL writer');
assert(photoCron.includes("collection('funnel_events')"), 'Funnel maintenance must be preserved');
assert(!photoCron.includes('deleteExpiredPhotoPage') && !photoCron.includes('getMaintenanceBucket'), 'Creation-age photo purge still connected');
assert(legacyStorage.includes("throw new Error('AGE_ONLY_PHOTO_PURGE_DISABLED')"), 'Legacy age-only helper must fail closed');
assert(photoApi.includes("collection('verification_events')") && photoApi.includes("where('fotoLoeschenAb'") && photoApi.includes('decidedAt'), 'Decision-bound purge missing');
assert(signedScheduler.includes('X-Klar-Compliance-Signature'), 'Signed scheduler missing');
for (const token of ['KLAR_CONFIRM_RETENTION', 'set -euo pipefail']) assert(script.includes(token), 'Missing retention approval guard: ' + token);
console.log('PASS: documented 20-group TTL candidate; creation-age photo sweep disabled. LIVE ACTIVE NOT VERIFIED; NO-GO.');
