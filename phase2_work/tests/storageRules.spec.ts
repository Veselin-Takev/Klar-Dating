// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getAppBucket } from '../src/server/storage';
import { deleteAccountPhotos, deleteExpiredPhotoPage, PHOTO_RETENTION_MS } from '../functions/src/retention';

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
  it('allows only the non-guest owner to upload; no client can read a verification photo', async () => {
    const path = `verification/${prefix}/photo.jpg`;
    await assertSucceeds(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(user('another').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(Promise.resolve(user(prefix, 'anonymous').ref(path).put(image, { contentType: 'image/jpeg' })));
    await assertFails(user(prefix).ref(path).getDownloadURL());
    await assertFails(user(prefix).ref(path).delete());
    await assertFails(Promise.resolve(user(prefix).ref(path).put(image, { contentType: 'text/html' })));
    await assertFails(Promise.resolve(user(prefix).ref(path).put(new Uint8Array(8 * 1024 * 1024), { contentType: 'image/jpeg' })));
  });
  it('documents actual emulator policy: a different tenant-claim user can read another account profile image', async () => {
    // Deliberately a characterization test, NOT a security approval.
    // A user-visible profile image may intentionally be public to all signed-in users.
    // The present Storage Rules have no tenantId check on profile reads.
    const ownerUid = `${prefix}-tenant-a`;
    const path = `profiles/${ownerUid}/tenant-cross-read.jpg`;
    const bucket = getAppBucket();
    const profile = bucket.file(path);
    const owner = env.authenticatedContext(ownerUid, {
      tenantId: 'tenant-a', firebase: { sign_in_provider: 'password' },
    }).storage('gs://demo-klar.appspot.com');
    const otherTenant = env.authenticatedContext(`${prefix}-tenant-b`, {
      tenantId: 'tenant-b', firebase: { sign_in_provider: 'password' },
    }).storage('gs://demo-klar.appspot.com');
    try {
      await assertSucceeds(Promise.resolve(owner.ref(path).put(image, { contentType: 'image/jpeg' })));
      // This is the expected CURRENT policy: signed-in cross-tenant reads are allowed.
      // Do not replace with assertFails until the product/DPO profile visibility policy
      // and an authorized tenant-aware Storage Rules migration are approved.
      await assertSucceeds(otherTenant.ref(path).getMetadata());
      await assertFails(Promise.resolve(otherTenant.ref(path).put(image, { contentType: 'image/jpeg' })));
      await assertFails(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com').ref(path).getMetadata());
    } finally {
      if ((await profile.exists())[0]) await profile.delete();
    }
  });

  it('denies client reads of another tenant-claim verification photo even though profile reads are allowed', async () => {
    const ownerUid = `${prefix}-biometric-owner`;
    const path = `verification/${ownerUid}/tenant-isolation.jpg`;
    const bucket = getAppBucket();
    const verification = bucket.file(path);
    const owner = env.authenticatedContext(ownerUid, {
      tenantId: 'tenant-a', firebase: { sign_in_provider: 'password' },
    }).storage('gs://demo-klar.appspot.com');
    const otherTenant = env.authenticatedContext(`${prefix}-tenant-b`, {
      tenantId: 'tenant-b', firebase: { sign_in_provider: 'password' },
    }).storage('gs://demo-klar.appspot.com');
    try {
      await assertSucceeds(Promise.resolve(owner.ref(path).put(image, { contentType: 'image/jpeg' })));
      await assertFails(owner.ref(path).getMetadata());
      await assertFails(otherTenant.ref(path).getMetadata());
      await assertFails(Promise.resolve(otherTenant.ref(path).put(image, { contentType: 'image/jpeg' })));
      await assertFails(owner.ref(path).delete());
    } finally {
      if ((await verification.exists())[0]) await verification.delete();
    }
  });

  it('keeps an old, undecided verification photo when the legacy worker is invoked', async () => {
    const bucket = getAppBucket();
    const photo = bucket.file(`verification/${prefix}/photo.jpg`);
    await photo.save(image);
    expect((await photo.exists())[0]).toBe(true);
    await expect(deleteExpiredPhotoPage(bucket, new Date(Date.now() + PHOTO_RETENTION_MS + 1000)))
      .rejects.toThrow('legacy_age_only_photo_purge_disabled');
    expect((await photo.exists())[0]).toBe(true);
    // Isolated emulator fixture cleanup, not the disabled legacy purge.
    await photo.delete();
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
