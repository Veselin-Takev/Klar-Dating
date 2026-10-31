// Static, offline regression: prevents reintroducing upload-age biometric purges.
// These tests are not evidence of Cloud Scheduler state or Storage TTL behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');

function assertLegacyBoundary(source) {
  assert.doesNotMatch(source, /\bgetMaintenanceBucket\b/, 'Legacy cron must not obtain a Storage bucket');
  assert.doesNotMatch(source, /\bdeleteExpiredPhotoPage\b/, 'Legacy cron must not call upload-age photo deletion');
  assert.doesNotMatch(source, /\bgetFiles\s*\(/, 'Legacy cron must not scan Storage files');
  assert.doesNotMatch(source, /\.delete\s*\(\s*\{\s*ifGenerationMatch/, 'Legacy cron must not delete Storage objects');
  assert.match(source, /export const deleteExpiredPhotosCron\b/, 'Keep the deployed function export for a controlled migration');
  assert.match(source, /collection\('funnel_events'\)/, 'Legacy cron must retain its expiring funnel-event cleanup');
}

test('legacy cron cannot delete verification blobs by upload age', () => {
  assertLegacyBoundary(read('functions/src/deleteExpiredPhotos.ts'));
});

test('legacy age-based scanner reintroduction is detected', () => {
  const clean = read('functions/src/deleteExpiredPhotos.ts');
  for (const unsafe of [
    'getMaintenanceBucket()', 'deleteExpiredPhotoPage(bucket, now)',
    'bucket.getFiles({ prefix: "verification/" })',
    'file.delete({ ifGenerationMatch: generation })',
  ]) {
    assert.throws(() => assertLegacyBoundary(clean + '\n' + unsafe));
  }
});

function assertExplicitFinalDecisionGuard(engine) {
  assert.match(engine,
    /artifact\.status !== 'approved'\s*&&\s*artifact\.status !== 'rejected'/,
    'Retention must block EVERY state other than approved/rejected, not only pending');
}

test('signed decision-aware purge path remains registered and requires explicit final moderation', () => {
  const functionsIndex = read('functions/src/index.ts');
  const signedCron = read('functions/src/purgeVerificationStorage.ts');
  const route = read('src/server/routes/complianceStorage.ts');
  const engine = read('src/server/platform/storageRetentionEngine.ts');
  assert.match(functionsIndex, /export \{ deleteExpiredPhotosCron \}/);
  assert.match(functionsIndex, /export \{ purgeVerificationStorageCron \}/);
  const storageRetention = read('functions/src/retention.ts');
  assert.doesNotMatch(storageRetention, /export\s+(?:async\s+)?function\s+deleteExpiredPhotoPage\b/,
    'Upload-age photo scanner must not remain exported from the retention module');
  assert.match(signedCron, /createHmac\(/);
  assert.match(signedCron, /\/api\/admin\/purge-verification-storage/);
  assert.match(route, /\.where\('fotoLoeschenAb', '<=', new Date\(now\)\)/);
  assert.match(route, /validComplianceRequest\(/);
  assert.match(route, /scanPurgePages\(/, 'Purge endpoint must use bounded page scanner');
  assert.match(route, /FieldPath\.documentId\(\)/, 'Purge ordering must use a stable document ID tie breaker');
  assert.match(route, /leaseId: null, leaseUntil: null/, 'Purge scan lease must be released');
  assert.match(route, /result\.failed > 0 \|\| result\.hasMore/, 'Unfinished work must not be acknowledged as GO');
  assert.match(route, /ifGenerationMatch/, 'Purge route must use Storage generation preconditions');
  assert.match(route, /isActiveOrMalformedHold\(metadata\.temporaryHold\)/, 'Purge route must reject active or malformed temporary object holds');
  assert.match(route, /isActiveOrMalformedHold\(metadata\.eventBasedHold\)/, 'Purge route must reject active or malformed event-based holds');
  assert.match(route, /value !== undefined && value !== null && value !== false/, 'Missing/false holds may pass; malformed values must fail closed');
  assert.match(route, /'legalHold' in data && data\.legalHold !== false/, 'Explicit legal hold data must fail closed unless false');
  assert.match(route, /'retentionHold' in data && data\.retentionHold !== false/, 'Explicit retention hold data must fail closed unless false');
  assert.match(route, /res\.status\(incomplete \? 503 : 200\)/, 'Partial failures and unfinished pages must be retryable HTTP errors');
  assert.doesNotMatch(route, /res\.json\(\{ ok: true, \.\.\.summary \}\)/, 'Do not disclose per-user purge paths');
  assertExplicitFinalDecisionGuard(engine);
  assert.match(engine, /isVerificationArtifactExpired\(artifact\.decidedAt/);
});

test('a pending-only moderation guard cannot pass the retention policy gate', () => {
  const engine = read('src/server/platform/storageRetentionEngine.ts');
  assertExplicitFinalDecisionGuard(engine);
  const reverted = engine.replace(
    "artifact.status !== 'approved' && artifact.status !== 'rejected'",
    "artifact.status === 'pending'",
  );
  assert.notEqual(reverted, engine, 'test mutation must replace the current final-decision guard');
  assert.throws(() => assertExplicitFinalDecisionGuard(reverted),
    /Retention must block EVERY state/);
});

test('boolean-only hold checks cannot silently replace malformed-hold guards', () => {
  const route = read('src/server/routes/complianceStorage.ts');
  const checks = [
    /isActiveOrMalformedHold\(metadata\.temporaryHold\)/,
    /isActiveOrMalformedHold\(metadata\.eventBasedHold\)/,
    /value !== undefined && value !== null && value !== false/,
  ];
  for (const rule of checks) assert.match(route, rule);
  const regressed = route.replace(
    'return value !== undefined && value !== null && value !== false;',
    'return value === true;',
  );
  assert.notEqual(regressed, route, 'test mutation must alter malformed-hold guard');
  assert.doesNotMatch(regressed, checks[2], 'malformed hold values must not be accepted');
});
