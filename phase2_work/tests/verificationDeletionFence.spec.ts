// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildVerificationDeletionFence,
  createVerificationDeletionFence,
  markVerificationDeletionComplete,
  readVerificationDeletionFence,
  reserveVerificationDeletion,
  setVerificationDeletionHold,
  verificationDeletionObjectKey,
  VerificationDeletionFenceError,
  type CreateVerificationDeletionFenceInput,
} from '../src/server/platform/verificationDeletionFence';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const emulatorAddress = /^(localhost|127\\.0\\.1|\\[::1\\]):([0-9]{1,5})$/.exec(emulatorHost);
const emulatorActive = Boolean(emulatorAddress);
const selectedProjects = [
  process.env.GCLOUD_PROJECT,
  process.env.GOOGLE_CLOUD_PROJECT,
  process.env.FIREBASE_PROJECT_ID,
].filter(Boolean);

if (emulatorHost && (!emulatorAddress || Number(emulatorAddress[2]) < 1
  || Number(emulatorAddress[2]) > 65535
  || selectedProjects.some(project => project !== 'demo-klar')
  || process.env.NODE_ENV === 'production'
  || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true')) {
  throw new Error('verification_deletion_fence_emulator_target_unsafe');
}

const baseInput = (suffix: string): CreateVerificationDeletionFenceInput => ({
  uid: `fence-user-${suffix}`,
  challengeId: `challenge-${suffix}`,
  bucket: 'synthetic-klar-verification-test',
  storagePath: `verification/fence-user-${suffix}/photo.jpg`,
  observedGeneration: '773',
  observedMetageneration: '1',
  createdBy: 'emulator-test',
});

async function withEmulatorDb(testBody: (db: Firestore) => Promise<void>): Promise<void> {
  const suffix = randomUUID().replace(/-/g, '');
  const app = initializeApp({ projectId: 'demo-klar' }, 'verification-deletion-fence-' + suffix);
  const databaseId = 'deletion-fence-' + suffix;
  const db = getFirestore(app, databaseId);
  try {
    await testBody(db);
  } finally {
    try {
      await db.recursiveDelete(db.collection('verificationDeletionFences'));
    } finally {
      await deleteApp(app);
    }
  }
}

describe('verification deletion fence schema (pure unit tests)', () => {
  it('derives a stable object key bound to UID, bucket, path and exact generation', () => {
    const input = baseInput('stable');
    const first = verificationDeletionObjectKey(input);
    expect(verificationDeletionObjectKey(input)).toBe(first);
    expect(verificationDeletionObjectKey({ ...input, observedGeneration: '774' })).not.toBe(first);
    expect(verificationDeletionObjectKey({ ...input, storagePath: input.storagePath.replace('photo', 'other') })).not.toBe(first);
  });

  it('builds schema v1 with immutable object identity and monotonic counters', () => {
    const record = buildVerificationDeletionFence(baseInput('schema'));
    expect(record).toMatchObject({
      schemaVersion: 1,
      uid: 'fence-user-schema',
      storagePath: 'verification/fence-user-schema/photo.jpg',
      observedGeneration: '773',
      observedMetageneration: '1',
      decisionVersion: 0,
      holdVersion: 0,
      state: 'eligible',
      legalHoldActive: false,
      moderationHoldActive: false,
      accountErasureActive: false,
      reservationToken: null,
      deletedGeneration: null,
    });
  });

  it('creates the held initial state and nonzero hold version when any hold is already active', () => {
    const record = buildVerificationDeletionFence({ ...baseInput('initial-hold'), legalHoldActive: true });
    expect(record).toMatchObject({ state: 'held', legalHoldActive: true, holdVersion: 1 });
  });

  it('rejects a missing or malformed generation and a path outside the UID verification prefix', () => {
    expect(() => buildVerificationDeletionFence({
      ...baseInput('missing-generation'),
      observedGeneration: undefined,
    } as unknown as CreateVerificationDeletionFenceInput))
      .toThrow('verification_deletion_generation_missing_or_invalid');
    expect(() => buildVerificationDeletionFence({ ...baseInput('bad-generation'), observedGeneration: '0' }))
      .toThrow('verification_deletion_generation_missing_or_invalid');
    expect(() => buildVerificationDeletionFence({
      ...baseInput('bad-path'), storagePath: 'verification/another-user/photo.jpg',
    })).toThrow('verification_deletion_path_invalid');
  });

  it('rejects malformed hold values instead of coercing truthy values', () => {
    expect(() => buildVerificationDeletionFence({
      ...baseInput('bad-hold'), legalHoldActive: 'false',
    } as unknown as CreateVerificationDeletionFenceInput))
      .toThrow('verification_deletion_hold_flag_invalid');
  });
});

describe.skipIf(!emulatorActive)('verification deletion fence Firestore Emulator transactions', () => {
  it('creates and atomically reserves a generation-bound eligible fence', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('reserve'));
      const result = await reserveVerificationDeletion(db, created.objectKey, 'purge-worker-1');
      expect(result.status).toBe('reserved');
      if (result.status !== 'reserved') throw new Error('expected_reservation');
      expect(result.reservationToken).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.fence).toMatchObject({
        objectKey: created.objectKey,
        observedGeneration: '773',
        state: 'delete_reserved',
        decisionVersion: 1,
        reservationOwner: 'purge-worker-1',
        reservationToken: result.reservationToken,
        legalHoldActive: false,
        moderationHoldActive: false,
        accountErasureActive: false,
      });
      expect((await readVerificationDeletionFence(db, created.objectKey)).reservationToken)
        .toBe(result.reservationToken);
    });
  }, 30_000);

  it('serializes a preservation hold before reservation and denies the purge', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('hold-before'));
      const held = await setVerificationDeletionHold(db, created.objectKey, 'legalHoldActive', 'legal-writer');
      expect(held).toMatchObject({
        state: 'held',
        legalHoldActive: true,
        holdVersion: 1,
        decisionVersion: 1,
      });
      await expect(reserveVerificationDeletion(db, created.objectKey, 'purge-worker-1'))
        .rejects.toMatchObject({ code: 'verification_deletion_held' });
      expect((await readVerificationDeletionFence(db, created.objectKey)).state).toBe('held');
    });
  }, 30_000);

  it('normalizes a legacy active hold observed on an eligible record into held atomically', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('legacy-hold'));
      await db.collection('verificationDeletionFences').doc(created.objectKey).update({ moderationHoldActive: true });
      const result = await reserveVerificationDeletion(db, created.objectKey, 'purge-worker-1');
      expect(result.status).toBe('held');
      if (result.status !== 'held') throw new Error('expected_held');
      expect(result.fence).toMatchObject({
        state: 'held',
        moderationHoldActive: true,
        decisionVersion: 1,
        holdVersion: 1,
        reservationToken: null,
      });
    });
  }, 30_000);

  it('rejects a hold arriving after deletion reservation and leaves the token fenced', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('late-hold'));
      const reserved = await reserveVerificationDeletion(db, created.objectKey, 'purge-worker-1');
      if (reserved.status !== 'reserved') throw new Error('expected_reservation');
      await expect(setVerificationDeletionHold(db, created.objectKey, 'legalHoldActive', 'legal-writer'))
        .rejects.toMatchObject({ code: 'verification_deletion_reservation_in_flight' });
      const current = await readVerificationDeletionFence(db, created.objectKey);
      expect(current.state).toBe('delete_reserved');
      expect(current.reservationToken).toBe(reserved.reservationToken);
      expect(current.legalHoldActive).toBe(false);
    });
  }, 30_000);

  it('rejects invalid state jumps and fencing-token substitution', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('invalid-jumps'));
      await expect(markVerificationDeletionComplete(db, created.objectKey, 'random-token', '773'))
        .rejects.toMatchObject({ code: 'verification_deletion_not_reserved' });
      expect((await readVerificationDeletionFence(db, created.objectKey)).state).toBe('eligible');

      const reserved = await reserveVerificationDeletion(db, created.objectKey, 'purge-worker-1');
      if (reserved.status !== 'reserved') throw new Error('expected_reservation');
      await expect(markVerificationDeletionComplete(db, created.objectKey, 'wrong-token', '773'))
        .rejects.toMatchObject({ code: 'verification_deletion_fencing_token_mismatch' });
      await expect(markVerificationDeletionComplete(db, created.objectKey, reserved.reservationToken, '774'))
        .rejects.toMatchObject({ code: 'verification_deletion_generation_changed' });

      const deleted = await markVerificationDeletionComplete(
        db, created.objectKey, reserved.reservationToken, '773',
      );
      expect(deleted).toMatchObject({
        state: 'deleted',
        decisionVersion: 2,
        deletedGeneration: '773',
      });
      const replay = await markVerificationDeletionComplete(
        db, created.objectKey, reserved.reservationToken, '773',
      );
      expect(replay.state).toBe('deleted');
      await expect(reserveVerificationDeletion(db, created.objectKey, 'purge-worker-2'))
        .rejects.toMatchObject({ code: 'verification_deletion_not_eligible' });
    });
  }, 30_000);

  it('permits exactly one concurrent reservation for a single object generation', async () => {
    await withEmulatorDb(async db => {
      const created = await createVerificationDeletionFence(db, baseInput('concurrent'));
      const results = await Promise.allSettled([
        reserveVerificationDeletion(db, created.objectKey, 'purge-worker-a'),
        reserveVerificationDeletion(db, created.objectKey, 'purge-worker-b'),
      ]);
      const winners = results.filter(result => result.status === 'fulfilled');
      const losers = results.filter(result => result.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect((losers[0] as PromiseRejectedResult).reason).toBeInstanceOf(VerificationDeletionFenceError);
      expect((await readVerificationDeletionFence(db, created.objectKey)).state).toBe('delete_reserved');
    });
  }, 30_000);

  it('refuses to overwrite an existing fence or mutate its observed generation', async () => {
    await withEmulatorDb(async db => {
      const input = baseInput('immutable');
      const created = await createVerificationDeletionFence(db, input);
      await expect(createVerificationDeletionFence(db, input))
        .rejects.toMatchObject({ code: 'verification_deletion_fence_already_exists' });
      expect((await readVerificationDeletionFence(db, created.objectKey)).observedGeneration).toBe('773');
      await expect(markVerificationDeletionComplete(db, created.objectKey, 'no-token', '774'))
        .rejects.toMatchObject({ code: 'verification_deletion_not_reserved' });
      expect((await readVerificationDeletionFence(db, created.objectKey)).observedGeneration).toBe('773');
    });
  }, 30_000);
});
