// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getAppBucket } from '../src/server/storage';
import { deleteAccountPhotos } from '../functions/src/retention';
import { executeVerificationRetentionBatch, MS_PER_DAY } from '../src/server/platform/storageRetentionEngine';
import { deleteVerificationStorageFile } from '../src/server/routes/complianceStorage';

let env: RulesTestEnvironment;
const prefix = `storage-${crypto.randomUUID()}`;
beforeAll(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) return;
  const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-klar', storage: { rules: readFileSync('storage.rules', 'utf8'), host, port: Number(port) } });
});
afterAll(async () => { await env?.cleanup(); });
const user = (uid: string, provider: 'password' | 'anonymous' = 'password') => env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).storage('gs://demo-klar.appspot.com');
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
describe.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('Storage rules and automatic photo retention', () => {
  it('denies all legacy verification photo uploads, reads and deletes including the authenticated owner', async () => {
    const path = `verification/${prefix}/photo.jpg`;
    // Legacy gesture/photo verification has been retired in favor of Didit.
    await assertFails(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(user('another').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(user(prefix, 'anonymous').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(user(prefix).ref(path).getDownloadURL());
    await assertFails(user(prefix).ref(path).delete());
    await assertFails(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'text/html' })));
  });

  it('prevents client overwrite of a retained verification object and recreation after Admin SDK deletion', async () => {
    const path = `verification/${prefix}/write-locked.jpg`;
    const file = getAppBucket().file(path);
    await file.save(image, { contentType: 'image/jpeg' });
    try {
      await assertFails(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' })));
      expect((await file.exists())[0]).toBe(true);
      await file.delete();
      await assertFails(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' })));
      expect((await file.exists())[0]).toBe(false);
    } finally {
      if ((await file.exists())[0]) await file.delete();
    }
  });
  it('preserves allowed owner profile uploads while legacy verification uploads are denied', async () => {
    const path = `profiles/${prefix}/owner-photo.jpg`;
    const file = getAppBucket().file(path);
    try {
      await assertSucceeds(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' })));
      expect((await file.exists())[0]).toBe(true);
      await assertFails(Promise.resolve(user('another').ref(path).put(image, { contentType: 'image/jpeg' })));
    } finally {
      if ((await file.exists())[0]) await file.delete();
    }
  });
  it('never deletes an old verification photo while moderation is pending', async () => {
    const bucket = getAppBucket();
    const path = `verification/${prefix}/pending-test.jpg`;
    const photo = bucket.file(path);
    await photo.save(image);
    const now = Date.now();
    const oldDecisionTime = now - 31 * MS_PER_DAY;
    const result = await executeVerificationRetentionBatch(
      [{ uid: prefix, challengeId: 'pending-test', storagePath: path,
        status: 'pending', decidedAt: oldDecisionTime }],
      async target => { await deleteVerificationStorageFile(bucket.file(target)); },
      async () => { throw new Error('pending verification may not create a purge audit'); },
      now,
    );
    expect(result.purgedCount).toBe(0);
    expect(result.results[0]?.reason).toBe('pending_decision');
    expect((await photo.exists())[0]).toBe(true);
    await photo.delete();
  });

  it('deletes a decided and expired verification photo with a Storage generation precondition', async () => {
    const bucket = getAppBucket();
    const path = `verification/${prefix}/decided-test.jpg`;
    const photo = bucket.file(path);
    await photo.save(image);
    const now = Date.now();
    const audit = vi.fn().mockResolvedValue(undefined);
    const result = await executeVerificationRetentionBatch(
      [{ uid: prefix, challengeId: 'decided-test', storagePath: path,
        status: 'approved', decidedAt: now - 31 * MS_PER_DAY }],
      async target => { await deleteVerificationStorageFile(bucket.file(target)); },
      audit,
      now,
    );
    expect(result.purgedCount).toBe(1);
    expect(audit).toHaveBeenCalledOnce();
    expect((await photo.exists())[0]).toBe(false);
  });
  it('account erasure deletes both photo prefixes without crossing account boundaries', async () => {
    const bucket = getAppBucket();
    const paths = [`profiles/${prefix}/a.jpg`, `verification/${prefix}/a.jpg`, `profiles/${prefix}-other/a.jpg`];
    for (const path of paths) await bucket.file(path).save(image);
    await deleteAccountPhotos(bucket, prefix);
    expect((await bucket.file(paths[0]!).exists())[0]).toBe(false);
    expect((await bucket.file(paths[1]!).exists())[0]).toBe(false);
    expect((await bucket.file(paths[2]!).exists())[0]).toBe(true);
    await bucket.file(paths[2]!).delete();
  });
});
