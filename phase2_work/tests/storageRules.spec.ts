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
  const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':');
  if (!firestoreHost || !firestorePort) throw new Error('Firestore emulator required for authoritative Storage policy tests');
  env = await initializeTestEnvironment({ projectId: 'demo-klar',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: firestoreHost, port: Number(firestorePort) },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host, port: Number(port) } });
  await seedUser(prefix, { isAdult: true, mediaAccessState: 'active' });
});
afterAll(async () => { await env?.cleanup(); });
const user = (uid: string, provider: 'password' | 'anonymous' = 'password') => env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).storage('gs://demo-klar.appspot.com');
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
async function seedUser(uid: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(context => context.firestore().doc(`tenants/default/users/${uid}`).set(data));
}
describe.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('Storage rules and automatic photo retention', () => {
  it.each(['anonymous', 'minor', 'missing', 'unmigrated', 'erasing'])('denies profile reads to %s principals, including forged adult claims', async kind => {
    const path = `profiles/${prefix}/reader-${kind}.jpg`;
    await getAppBucket().file(path).save(image, { metadata: {contentType:'image/jpeg', metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}} });
    const uid = `${prefix}-${kind}`;
    if (kind !== 'missing') await seedUser(uid, { isAdult: kind !== 'minor', ...(kind === 'unmigrated' ? {} : {mediaAccessState: kind === 'erasing' ? 'erasing' : 'active'}) });
    const actor = env.authenticatedContext(uid, { isAdult: true, firebase: { sign_in_provider: kind === 'anonymous' ? 'anonymous' : 'password' } }).storage('gs://demo-klar.appspot.com');
    await assertFails(actor.ref(path).getDownloadURL());
    await assertSucceeds(user(prefix).ref(path).delete());
  });
  it('denies direct uploads and denies direct reads even for active adults but immediately blocks a fenced owner', async () => {
    const reader = `${prefix}-adult-reader`, path = `profiles/${prefix}/adult-read.jpg`;
    await seedUser(reader, { isAdult: true, mediaAccessState: 'active' });
    await getAppBucket().file(path).save(image, { metadata: {contentType:'image/jpeg', metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}} });
    await assertFails(Promise.resolve(user(prefix).ref(path).put(image, {contentType:'image/jpeg'})));
    await assertFails(user(reader).ref(path).getDownloadURL());
    await seedUser(prefix, { isAdult: true, mediaAccessState: 'erasing' });
    await assertFails(user(reader).ref(path).getDownloadURL());
    await seedUser(prefix, { isAdult: false, mediaAccessState: 'active' });
    await assertFails(user(reader).ref(path).getDownloadURL());
    await seedUser(prefix, { isAdult: true, mediaAccessState: 'active' });
    await assertSucceeds(user(prefix).ref(path).delete());
  });
  it.each(['pending', 'manual_review', 'completed'])('blocks create and update for every existing deletion job (%s)', async status => {
    const uid = `${prefix}-deletion-${status}`, path = `verification/${uid}/photo.jpg`;
    await seedUser(uid, {isAdult:true,mediaAccessState:'active'});
    await getAppBucket().file(path).save(image, {metadata:{contentType:'image/jpeg'}});
    await env.withSecurityRulesDisabled(context => context.firestore().doc(`tenants/default/account_deletions/${uid}`).set({status}));
    await assertFails(Promise.resolve(user(uid).ref(path).put(image,{contentType:'image/jpeg'})));
    await assertFails(Promise.resolve(user(uid).ref(`verification/${uid}/new.jpg`).put(image,{contentType:'image/jpeg'})));
    await assertFails(Promise.resolve(user(uid).ref(`profiles/${uid}/new.jpg`).put(image,{contentType:'image/jpeg'})));
  });
  it('forbids clients from forging the authoritative media fence', async () => {
    const uid = `${prefix}-forge`;
    await seedUser(uid, {uid,isAdult:true,mediaAccessState:'erasing'});
    const client = env.authenticatedContext(uid, {firebase:{sign_in_provider:'password'}}).firestore();
    await assertFails(client.doc(`tenants/default/users/${uid}`).update({mediaAccessState:'active'}));
  });
  it('denies legacy suspended principals before any lock backfill, including privileged claims', async () => {
    const uid = `${prefix}-legacy-suspended`;
    await seedUser(uid,{uid,isAdult:true,mediaAccessState:'active',active:false,name:'Synthetic blocked account'});
    const client=env.authenticatedContext(uid,{role:'admin',firebase:{sign_in_provider:'password'}}).firestore();
    await assertFails(client.doc(`tenants/default/users/${uid}`).get());
    await assertFails(client.doc(`tenants/default/users/${uid}`).update({name:'forbidden'}));
  });
  it.each(['tenant-a', 'tenant-b'])('denies tenant-scoped UID collisions in Storage (%s)', async tenant => {
    const tenantClaims = {tenant, sign_in_provider: 'password' as const};
    const path = `profiles/${prefix}/tenant-check.jpg`;
    await getAppBucket().file(path).save(image, { metadata: {contentType:'image/jpeg', metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}} });
    const foreign = env.authenticatedContext(prefix, {firebase: tenantClaims}).storage('gs://demo-klar.appspot.com');
    await assertFails(foreign.ref(path).getDownloadURL());
    await assertFails(Promise.resolve(foreign.ref(path).put(image, {contentType: 'image/jpeg'})));
    await assertFails(foreign.ref(path).delete());
    await assertFails(Promise.resolve(foreign.ref(`verification/${prefix}/tenant-check.jpg`).put(image, {contentType: 'image/jpeg'})));
    await assertSucceeds(user(prefix).ref(path).delete());
  });
  it('denies all direct verification uploads and reads, including the registered adult owner', async () => {
    const path = `verification/${prefix}/photo.jpg`;
    await getAppBucket().file(path).save(image, { metadata: {contentType:'image/jpeg', metadata:{firebaseStorageDownloadTokens:crypto.randomUUID()}} });
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
