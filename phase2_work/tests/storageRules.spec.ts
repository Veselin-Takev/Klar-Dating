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
const tenantUser = (uid: string, tenantId: string) =>
  env.authenticatedContext(uid, {
    tenantId,
    firebase: { sign_in_provider: 'password' },
  }).storage('gs://demo-klar.appspot.com');

const assertLoopbackStorageEmulator = () => {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '';
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(host) ||
      (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-klar') ||
      (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== 'demo-klar')) {
    throw new Error('storage_tenant_test_requires_loopback_demo_emulator');
  }
};
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
  it('P0 #254: cross-tenant signed-in profile metadata is CURRENTLY readable (review evidence, NOT isolation)', async () => {
    assertLoopbackStorageEmulator();
    const ownerUid = `${prefix}-tenant-a`;
    const otherUid = `${prefix}-tenant-b`;
    const path = `profiles/${ownerUid}/cross-tenant-read.jpg`;
    const owner = tenantUser(ownerUid, 'tenant-A');
    const otherTenant = tenantUser(otherUid, 'tenant-B');
    await assertSucceeds(Promise.resolve(owner.ref(path).put(image, { contentType: 'image/jpeg' })));
    try {
      // Current Storage Rules use signedIn(), not tenantId, for profile reads.
      // This positive assertion documents existing behavior; it is NOT a
      // recommendation or proof of intended lawful cross-tenant visibility.
      await assertSucceeds(otherTenant.ref(path).getMetadata());
      await assertFails(env.unauthenticatedContext()
        .storage('gs://demo-klar.appspot.com').ref(path).getMetadata());
      await assertFails(Promise.resolve(otherTenant.ref(path).put(image, { contentType: 'image/jpeg' })));
      await assertFails(otherTenant.ref(path).delete());
    } finally {
      await assertSucceeds(owner.ref(path).delete());
    }
  }, 20_000);

  it('P0 #254: cross-tenant clients and owner cannot read biometric verification photos', async () => {
    assertLoopbackStorageEmulator();
    const ownerUid = `${prefix}-verification-a`;
    const otherUid = `${prefix}-verification-b`;
    const path = `verification/${ownerUid}/tenant-isolation.jpg`;
    const owner = tenantUser(ownerUid, 'tenant-A');
    const otherTenant = tenantUser(otherUid, 'tenant-B');
    await assertSucceeds(Promise.resolve(owner.ref(path).put(image, { contentType: 'image/jpeg' })));
    try {
      await assertFails(owner.ref(path).getMetadata());
      await assertFails(otherTenant.ref(path).getMetadata());
      await assertFails(otherTenant.ref(path).getDownloadURL());
      await assertFails(Promise.resolve(otherTenant.ref(path).put(image, { contentType: 'image/jpeg' })));
      await assertFails(otherTenant.ref(path).delete());
    } finally {
      // A server-side cleanup is allowed ONLY for this unique synthetic demo
      // emulator fixture. Clients intentionally cannot delete verification.
      await getAppBucket().file(path).delete();
    }
  }, 20_000);

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
