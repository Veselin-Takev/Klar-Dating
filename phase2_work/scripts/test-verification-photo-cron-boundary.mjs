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

test('signed decision-aware purge path remains registered and validates pending state', () => {
  const functionsIndex = read('functions/src/index.ts');
  const signedCron = read('functions/src/purgeVerificationStorage.ts');
  const route = read('src/server/routes/complianceStorage.ts');
  const engine = read('src/server/platform/storageRetentionEngine.ts');
  assert.match(functionsIndex, /export \{ deleteExpiredPhotosCron \}/);
  assert.match(functionsIndex, /export \{ purgeVerificationStorageCron \}/);
  assert.match(signedCron, /createHmac\(/);
  assert.match(signedCron, /\/api\/admin\/purge-verification-storage/);
  assert.match(route, /\.where\('fotoLoeschenAb', '<=', new Date\(now\)\)/);
  assert.match(route, /validComplianceRequest\(/);
  assert.match(engine, /artifact\.status === 'pending'/);
  assert.match(engine, /isVerificationArtifactExpired\(artifact\.decidedAt/);
});
