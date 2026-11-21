// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import {
  applyProfileMediaMigrationBatch,
  createProfileMediaMigrationPlan,
  profileMediaAliasSnapshotHash,
} from '../src/server/platform/profileMediaMigration';

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
const emulatorEnabled = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST
  && process.env.FIREBASE_STORAGE_EMULATOR_HOST
  && projectId.startsWith('demo-'),
);
const uid = 'media-migration-' + crypto.randomUUID();
const objectPath = `profiles/${uid}/avatar.jpg`;
const downloadUrl = 'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/'
  + encodeURIComponent(objectPath) + '?alt=media&token=emulator-migration-token';
const digest = 'c'.repeat(64);

describe.runIf(emulatorEnabled)('profile media migration against Firebase emulators', () => {
  const db = getDb();
  const bucket = getAppBucket();

  afterAll(async () => {
    await Promise.all([
      db.collection('users').doc(uid).delete(),
      bucket.file(objectPath).delete({ ignoreNotFound: true }),
    ]);
  });

  it('dry-run builds a canonical action plan with zero Firestore or Storage writes', async () => {
    await bucket.file(objectPath).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      metadata: { contentType: 'image/jpeg', metadata: { retain: 'yes' } },
    });
    await db.collection('users').doc(uid).set({ photoURL: downloadUrl, displayName: 'unchanged' });
    const before = await db.collection('users').doc(uid).get();
    const [beforeMetadata] = await bucket.file(objectPath).getMetadata();

    const plan = await createProfileMediaMigrationPlan([{
      collection: 'users', uid, data: before.data() as Record<string, unknown>,
    }], async path => {
      const [metadata] = await bucket.file(path).getMetadata();
      return {
        exists: true,
        generation: String(metadata.generation),
        metageneration: String(metadata.metageneration),
        contentType: metadata.contentType,
        size: Number(metadata.size),
      };
    }, digest);

    const after = await db.collection('users').doc(uid).get();
    const [afterMetadata] = await bucket.file(objectPath).getMetadata();
    expect(plan.summary.actionsPlanned).toBe(1);
    expect(plan.actions[0]?.updates.photoURL).toMatch(/^klar-media:v1:/);
    expect(after.data()?.photoURL).toBe(downloadUrl);
    expect(after.data()?.displayName).toBe('unchanged');
    expect(afterMetadata.generation).toBe(beforeMetadata.generation);
    expect(afterMetadata.metageneration).toBe(beforeMetadata.metageneration);
    expect(JSON.stringify(plan.summary)).not.toContain(uid);
  });

  it('uses Firestore transaction compare-and-set and rejects a concurrent profile edit', async () => {
    await bucket.file(objectPath).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      metadata: { contentType: 'image/jpeg' },
    });
    await db.collection('users').doc(uid).set({ photoURL: downloadUrl });
    const original = await db.collection('users').doc(uid).get();
    const plan = await createProfileMediaMigrationPlan([{
      collection: 'users', uid, data: original.data() as Record<string, unknown>,
    }], async path => {
      const [metadata] = await bucket.file(path).getMetadata();
      return {
        exists: true,
        generation: String(metadata.generation),
        metageneration: String(metadata.metageneration),
        contentType: metadata.contentType,
        size: Number(metadata.size),
      };
    }, digest);

    await db.collection('users').doc(uid).update({ photoURL: 'profiles/another-owner/replaced.jpg' });
    const result = await applyProfileMediaMigrationBatch(plan, {
      compareAndSet: async action => db.runTransaction(async tx => {
        const ref = db.collection(action.collection).doc(action.uid);
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return 'conflict';
        const data = snapshot.data() as Record<string, unknown>;
        if (data.photoURL === action.updates.photoURL) return 'already-applied';
        if (profileMediaAliasSnapshotHash(data) !== action.expectedAliasSnapshotHash) return 'conflict';
        tx.update(ref, action.updates as never);
        return 'updated';
      }),
    });
    const after = await db.collection('users').doc(uid).get();
    expect(result.stoppedOnConflict).toBe(true);
    expect(result.conflicts).toBe(1);
    expect(after.data()?.photoURL).toBe('profiles/another-owner/replaced.jpg');
  });
});
