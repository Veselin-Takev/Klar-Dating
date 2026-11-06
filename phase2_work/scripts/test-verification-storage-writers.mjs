import test from 'node:test';
import assert from 'node:assert/strict';
import { readVerificationEventSourceMap } from './check-verification-event-writers.mjs';
import { verificationStorageWriterViolations } from './check-verification-storage-writers.mjs';

const baseline = readVerificationEventSourceMap();
const mutate = (path, transform) => {
  const files = new Map(baseline);
  files.set(path, transform(files.get(path) ?? ''));
  return verificationStorageWriterViolations(files);
};

test('all reviewed runtime legacy Storage paths and delete calls have a source inventory', () => {
  assert.deepEqual(verificationStorageWriterViolations(baseline), []);
});

test('unreviewed direct legacy biometric Storage prefix requires source review', () => {
  assert.match(mutate('src/server/newStorageJob.ts', () =>
    "const path = 'verification/' + uid + '/photo';\nvoid path;",
  ).join('\n'), /unreviewed verification storage/);
});

test('new Admin-SDK file.delete cannot silently bypass reviewed deletion entrypoints', () => {
  assert.match(mutate('functions/src/unsafeStorage.ts', () =>
    'await file.delete({ ifGenerationMatch: 4 });',
  ).join('\n'), /unreviewed verification storage/);
});

test('an extra Storage deletion in an already-reviewed route triggers review', () => {
  assert.match(mutate('src/server/routes/complianceStorage.ts', src =>
    src + '\nawait file.delete({ ifGenerationMatch: 1 });',
  ).join('\n'), /writer inventory drift/);
});

test('removing GCS generation CAS from the purge is rejected', () => {
  assert.match(mutate('src/server/routes/complianceStorage.ts', src =>
    src.replace('await file.delete({ ifGenerationMatch: generation });', 'await file.delete();'),
  ).join('\n'), /boundary signature drift/);
});

test('altering the source-locked P0 live-purge veto is rejected', () => {
  assert.match(mutate('src/server/routes/complianceStorage.ts', src =>
    src.replace('const VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false;',
      'const VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = true;'),
  ).join('\n'), /boundary signature drift/);
});

test('dropping hold checks from Art.17 Storage cleanup is rejected', () => {
  assert.match(mutate('functions/src/retention.ts', src =>
    src.replace('metadata.temporaryHold || metadata.eventBasedHold',
      'false'),
  ).join('\n'), /boundary signature drift/);
});

test('Art.17 erasure cannot silently omit legacy photo cleanup', () => {
  assert.match(mutate('src/server/trustAndSafety.ts', src =>
    src.replace('await deleteAccountPhotos(getAppBucket(), meineUid)', 'Promise.resolve(true)'),
  ).join('\n'), /Art17 owner\/storage-delete coordination drift/);
});

test('removal of a reviewed Storage writer is an explicit audit change', () => {
  const files = new Map(baseline);
  files.delete('functions/src/retention.ts');
  assert.match(verificationStorageWriterViolations(files).join('\n'),
    /missing reviewed verification storage source/);
});

test('documentation mentioning a route is not misidentified as direct Storage write', () => {
  assert.deepEqual(mutate('functions/src/deleteExpiredPhotos.ts', src =>
    src + '\n// Verification route /api/verification/decide is retired.\n',
  ), []);
});

test('a Firestore reservation without atomic GCS intent is rejected by the static gate', () => {
  assert.match(mutate('src/server/platform/verificationPurgeFirestoreFence.ts', src =>
    src.replace('tx.update(ref, { photoPurgeFence: next, photoPurgeIntent: intent });',
      'tx.update(ref, { photoPurgeFence: next });'),
  ).join('\n'), /boundary signature drift/);
});

test('deleting the 30-day expiry guard is a security boundary change', () => {
  assert.match(mutate('src/server/platform/verificationPurgeFirestoreFence.ts', src =>
    src.replace('!isVerificationArtifactExpired(decidedAt, now)', 'false'),
  ).join('\n'), /boundary signature drift/);
});
