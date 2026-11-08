// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getAppBucket } from '../src/server/storage';
import { deleteAccountPhotos, deleteExpiredPhotoPage } from '../functions/src/retention';

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
  it.each(['tenant-a', 'tenant-b'])('denies tenant-scoped UID collisions in Storage (%s)', async tenant => {
    const tenantClaims = {tenant, sign_in_provider: 'password' as const};
    const path = `profiles/${prefix}/tenant-check.jpg`;
    await assertSucceeds(Promise.resolve(user(prefix).ref(path).put(image, {contentType: 'image/jpeg'})));
    const foreign = env.authenticatedContext(prefix, {firebase: tenantClaims}).storage('gs://demo-klar.appspot.com');
    await assertFails(foreign.ref(path).getDownloadURL());
    await assertFails(Promise.resolve(foreign.ref(path).put(image, {contentType: 'image/jpeg'})));
    await assertFails(foreign.ref(path).delete());
    await assertFails(Promise.resolve(foreign.ref(`verification/${prefix}/tenant-check.jpg`).put(image, {contentType: 'image/jpeg'})));
    await assertSucceeds(user(prefix).ref(path).delete());
  });
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
  it('refuses legacy age-only deletion against real emulator Storage objects', async () => {
    const bucket = getAppBucket();
    const photo = bucket.file(`verification/${prefix}/photo.jpg`);
    await photo.save(image);
    try {
      await expect(deleteExpiredPhotoPage(bucket, new Date('2100-01-01'))).rejects.toThrow('verification_photo_p0_fencing_unverified');
      expect((await photo.exists())[0]).toBe(true);
    } finally {
      await photo.delete();
    }
  });

  it('keeps both photo prefixes when account erasure encounters verification evidence', async () => {
    const bucket = getAppBucket();
    const paths = [`profiles/${prefix}/a.jpg`, `verification/${prefix}/a.jpg`, `profiles/${prefix}-other/a.jpg`];
    for (const path of paths) await bucket.file(path).save(image);
    try {
      await expect(deleteAccountPhotos(bucket, prefix)).rejects.toThrow('verification_photo_p0_fencing_unverified');
      for (const path of paths) expect((await bucket.file(path).exists())[0]).toBe(true);
    } finally {
      for (const path of paths) await bucket.file(path).delete();
    }
  });

  it('still deletes only owned profile photos when no verification files exist', async () => {
    const bucket = getAppBucket();
    const owner = `${prefix}-profiles-only`;
    const own = bucket.file(`profiles/${owner}/photo.jpg`);
    const foreign = bucket.file(`profiles/${owner}-other/photo.jpg`);
    await own.save(image);
    await foreign.save(image);
    try {
      expect(await deleteAccountPhotos(bucket, owner)).toBe(false);
      expect((await own.exists())[0]).toBe(false);
      expect((await foreign.exists())[0]).toBe(true);
      expect(await deleteAccountPhotos(bucket, owner)).toBe(true);
    } finally {
      await foreign.delete();
    }
  });

});
