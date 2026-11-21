// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  applyProfileMediaMigrationBatch,
  createProfileMediaMigrationPlan,
} from '../src/server/platform/profileMediaMigration';

const digest = 'a'.repeat(64);
const url = (path: string, token: string) =>
  'https://firebasestorage.googleapis.com/v0/b/klar-staging.appspot.com/o/' +
  encodeURIComponent(path) + '?alt=media&token=' + token;

function metadata(generation = '10', metageneration = '2') {
  return { exists: true, generation, metageneration, contentType: 'image/jpeg', size: 128 };
}

describe('deterministic profile media migration plan', () => {
  it('recognizes photoStoragePath/photoPath and URL aliases and keeps action output free of URLs and bearer tokens', async () => {
    const pathA = 'profiles/user-a/avatar.jpg';
    const pathB = 'profiles/user-a/second.jpg';
    const inspect = vi.fn(async (path: string) => path === pathA ? metadata() : metadata('11', '3'));
    const plan = await createProfileMediaMigrationPlan([{
      collection: 'users',
      uid: 'user-a',
      data: {
        photoStoragePath: pathA,
        photoPath: pathA,
        photoURL: url(pathA, 'secret-a'),
        photoUrl: url(pathA, 'secret-b'),
        photos: [url(pathB, 'secret-c')],
        bio: 'not part of the migration snapshot',
      },
    }], inspect, digest);

    expect(plan.summary).toMatchObject({ profilesScanned: 1, actionsPlanned: 1, unresolvedProfiles: 0 });
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(plan.actions[0]?.updates.photoStoragePath).toMatch(/^klar-media:v1:/);
    expect(plan.actions[0]?.updates.photoPath).toBe(plan.actions[0]?.updates.photoStoragePath);
    expect(plan.actions[0]?.updates.photoURL).toBe(plan.actions[0]?.updates.photoStoragePath);
    expect(plan.actions[0]?.updates.photoUrl).toBe(plan.actions[0]?.updates.photoStoragePath);
    expect((plan.actions[0]?.updates.photos as string[])[0]).toMatch(/^klar-media:v1:/);
    const serializedPlan = JSON.stringify(plan.actions);
    const serializedSummary = JSON.stringify(plan.summary);
    expect(serializedPlan).not.toContain('secret-a');
    expect(serializedPlan).not.toContain('secret-b');
    expect(serializedPlan).not.toContain('secret-c');
    expect(serializedPlan).not.toContain('firebasestorage.googleapis.com');
    expect(serializedSummary).not.toContain('user-a');
    expect(serializedSummary).not.toContain('avatar.jpg');
  });

  it('refuses conflicting scalar aliases instead of selecting a winner', async () => {
    const plan = await createProfileMediaMigrationPlan([{
      collection: 'users', uid: 'user-a',
      data: {
        photoURL: url('profiles/user-a/first.jpg', 'one'),
        photoUrl: url('profiles/user-a/second.jpg', 'two'),
      },
    }], async () => metadata(), digest);
    expect(plan.summary.conflictingAliases).toBe(1);
    expect(plan.summary.actionsPlanned).toBe(0);
  });

  it('classifies malformed URLs, unsupported hosts, wrong owners and missing objects as non-migratable', async () => {
    const plan = await createProfileMediaMigrationPlan([
      { collection: 'users', uid: 'user-a', data: { photoURL: 'https://firebasestorage.googleapis.com/%E0%A4%A?token=x' } },
      { collection: 'users', uid: 'user-b', data: { photoURL: 'https://evil.invalid/o/profiles%2Fuser-b%2Fx.jpg?token=x' } },
      { collection: 'users', uid: 'user-c', data: { photoStoragePath: 'profiles/user-d/wrong.jpg' } },
      { collection: 'users', uid: 'user-e', data: { photoPath: url('profiles/user-e/missing.jpg', 'missing') } },
    ], async path => path.endsWith('missing.jpg') ? { exists: false } : metadata(), digest, 'klar-staging.appspot.com');
    expect(plan.summary.malformedUrls).toBe(1);
    expect(plan.summary.unsupportedHosts).toBe(1);
    expect(plan.summary.unsupportedBuckets).toBe(0);
    expect(plan.summary.wrongOwnerPaths).toBe(1);
    expect(plan.summary.missingObjects).toBe(1);
    expect(plan.summary.actionsPlanned).toBe(0);
    expect(plan.summary.unresolvedProfiles).toBe(4);
  });

  it('rejects a legacy URL whose encoded bucket differs from the selected approved bucket', async () => {
    const plan = await createProfileMediaMigrationPlan([{
      collection: 'users', uid: 'user-a',
      data: { photoURL: 'https://firebasestorage.googleapis.com/v0/b/unapproved-bucket/o/profiles%2Fuser-a%2Fphoto.jpg?alt=media&token=secret' },
    }], async () => metadata(), digest, 'klar-staging.appspot.com');
    expect(plan.summary.unsupportedBuckets).toBe(1);
    expect(plan.summary.actionsPlanned).toBe(0);
    expect(JSON.stringify(plan.summary)).not.toContain('unapproved-bucket');
  });

  it('stops at a compare-and-set conflict and checkpoints only completed records', async () => {
    const records = ['a', 'b', 'c'].map(uid => ({
      collection: 'users' as const,
      uid,
      data: { photoStoragePath: `profiles/${uid}/photo.jpg` },
    }));
    const plan = await createProfileMediaMigrationPlan(records, async () => metadata(), digest);
    const onCheckpoint = vi.fn();
    const compareAndSet = vi.fn()
      .mockResolvedValueOnce('updated' as const)
      .mockResolvedValueOnce('conflict' as const);
    const result = await applyProfileMediaMigrationBatch(plan, { compareAndSet }, {
      batchSize: 2, maxBatches: 2, onCheckpoint,
    });
    expect(compareAndSet).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      processedThisRun: 1,
      conflicts: 1,
      stoppedOnConflict: true,
      complete: false,
      checkpoint: { nextIndex: 1, updated: 1, alreadyApplied: 0 },
    });
    expect(onCheckpoint).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and processes no more than the configured bounded batch', async () => {
    const records = ['a', 'b', 'c'].map(uid => ({
      collection: 'public_profiles' as const,
      uid,
      data: { photoPath: `profiles/${uid}/photo.jpg` },
    }));
    const plan = await createProfileMediaMigrationPlan(records, async () => metadata(), digest);
    const first = await applyProfileMediaMigrationBatch(plan, {
      compareAndSet: async () => 'updated',
    }, { batchSize: 1, maxBatches: 1 });
    expect(first).toMatchObject({ processedThisRun: 1, complete: false, checkpoint: { nextIndex: 1 } });

    const second = await applyProfileMediaMigrationBatch(plan, {
      compareAndSet: async () => 'already-applied',
    }, { checkpoint: first.checkpoint, batchSize: 1, maxBatches: 1 });
    expect(second).toMatchObject({
      processedThisRun: 1,
      complete: false,
      checkpoint: { nextIndex: 2, updated: 1, alreadyApplied: 1 },
    });

    await expect(applyProfileMediaMigrationBatch(plan, {
      compareAndSet: async () => 'updated',
    }, { checkpoint: second.checkpoint, batchSize: 1, maxBatches: 1 })).resolves.toMatchObject({
      complete: true,
      checkpoint: { nextIndex: 3 },
    });
  });
});
