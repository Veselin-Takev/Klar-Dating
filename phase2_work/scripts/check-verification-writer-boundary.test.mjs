import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectVerificationWriterBoundary } from './check-verification-writer-boundary.mjs';

const baseline = [
  ['src/server/klarCore.ts', [
    'const file = bucket.file(pfad);',
    'const writerIntentId = await beginVerificationDeletionWriterIntent(firestore, input);',
    'await file.save(bytes, { metadata: { klarWriter: TRUSTED_VERIFICATION_WRITER_MARKER } });',
    'await completeVerificationDeletionWriterIntent(firestore, writerIntentId, key, generation, metageneration);',
    'ensureVerificationDeletionFenceForUploadedObject',
  ].join('\n')],
  ['functions/src/verificationObjectFinalized.ts', "onObjectFinalized({ retry: true }, async () => fetch('/internal/verification/object-finalized'))"],
  ['src/server/platform/verificationObjectRegistration.ts', 'TRUSTED_VERIFICATION_WRITER_MARKER ensureVerificationDeletionFenceForUploadedObject'],
  ['src/server/routes/verificationObjectFinalized.ts', 'registerFinalizedVerificationObject'],
  ['functions/src/retention.ts', [
    "mode: 'profile-only' | 'unsafe-emulator-test-only' = 'profile-only'",
    "if (mode === 'profile-only') await assertNoUnfencedVerificationPhotos();",
    "'profiles/'",
    'verification_photo_p0_fencing_unverified',
  ].join('\n')],
  ['src/server/trustAndSafety.ts', 'deleteAccountPhotos(getAppBucket(), meineUid)'],
  ['src/server/routes/complianceStorage.ts', [
    "if (process.env.NODE_ENV === 'production' || !deps.getBucket)",
    "return res.status(503).json({ code: 'verification_storage_purge_p0_fencing_unverified' })",
    'prepareVerificationDeleteCas',
  ].join('\n')],
  ['src/server/routes/verificationDeletionHold.ts', 'beginVerificationDeletionHold confirmVerificationDeletionHold ifGenerationMatch ifMetagenerationMatch'],
  ['functions/src/deleteExpiredPhotos.ts', 'funnel_events expiresAt'],
];

function inspect(extra = []) {
  return inspectVerificationWriterBoundary([...baseline, ...extra]);
}

test('registered baseline satisfies the static writer boundary', () => {
  assert.deepEqual(inspect(), []);
});

test('unregistered Admin SDK verification upload is rejected', () => {
  const violations = inspect([['src/server/newVerificationWriter.ts',
    "const file = getStorage().bucket().file('verification/synthetic/photo.jpg'); await file.save(bytes);"]]);
  assert.ok(violations.some(value => value.includes('unregistered Storage mutation path')));
});

test('bypassed verification delete path is rejected', () => {
  const violations = inspect([['functions/src/newPurge.ts',
    'const object = bucket.file(storagePath); await object.delete({ ifGenerationMatch: generation });']]);
  assert.ok(violations.some(value => value.includes('unregistered Storage mutation path')));
});

test('missing Writer-Intent binding in the canonical writer is rejected', () => {
  const broken = baseline.map(([file, source]) => [file, file === 'src/server/klarCore.ts'
    ? source.replace('beginVerificationDeletionWriterIntent(firestore, input);', 'const writerIntentId = "missing";')
    : source]);
  const violations = inspectVerificationWriterBoundary(broken);
  assert.ok(violations.some(value => value.includes('reserve Writer-Intent before save')));
});

test('path/prefix construction evasion is rejected even when assembled dynamically', () => {
  const violations = inspect([['src/server/obfuscatedWriter.ts',
    "const prefix = ['veri', 'fication'].join(''); const file = bucket.file(prefix + '/' + owner); await file.save(bytes);"]]);
  assert.ok(violations.some(value => value.includes('unregistered Storage mutation path')));
});