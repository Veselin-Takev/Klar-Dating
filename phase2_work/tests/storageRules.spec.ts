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
  const firestore = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const parsedFirestore = /^(127\.0\.0\.1|localhost):(\d{1,5})$/.exec(firestore);
  const configured = JSON.parse(readFileSync('firebase.json', 'utf8'));
  if (!parsedFirestore || Number(parsedFirestore[2]) !== configured.emulators.firestore.port
      || ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']
        .some(key => process.env[key] && process.env[key] !== 'demo-klar')
      || process.env.NODE_ENV === 'production') {
    throw new Error('storage_age_gate_requires_local_firestore_emulator');
  }
  env = await initializeTestEnvironment({
    projectId: 'demo-klar',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host, port: Number(port) },
    firestore: { rules: readFileSync('firestore.rules', 'utf8'),
      host: parsedFirestore[1], port: Number(parsedFirestore[2]) },
  });
  await env.withSecurityRulesDisabled(async context => {
    const users = context.firestore().collection('users');
    await Promise.all([
      users.doc(prefix).set({ isAdult: true }),
      users.doc(prefix + '-minor').set({ isAdult: false }),
      users.doc('another').set({ isAdult: true }),
    ]);
  });
});
afterAll(async () => {
  if (!env) return;
  await env.withSecurityRulesDisabled(async context => {
    const users = context.firestore().collection('users');
    await Promise.all([
      users.doc(prefix).delete(),
      users.doc(prefix + '-minor').delete(),
      users.doc('another').delete(),
    ]);
  });
  await env.cleanup();
});
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
  it('enforces both authoritatively adult users at actual Storage + Firestore boundary', async () => {
    const path = `profiles/${prefix}/avatar.jpg`;
    await assertSucceeds(user(prefix).ref(path).put(image, { contentType: 'image/jpeg' }));
    await assertSucceeds(user('another').ref(path).getDownloadURL());
    await assertFails(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com').ref(path).getDownloadURL());
    await assertFails(user(prefix, 'anonymous').ref(path).getDownloadURL());
    await assertFails(user(prefix + '-minor').ref(path).getDownloadURL());
    await assertFails(user('unknown-adult').ref(path).getDownloadURL());
    await assertFails(user(prefix + '-minor').ref(`profiles/${prefix}-minor/own.jpg`).put(image, { contentType: 'image/jpeg' }));
    await assertFails(user('another').ref(path).delete());
    await assertSucceeds(user(prefix).ref(path).delete());
    // A synthetically existing minor-owned profile cannot be read by adults.
    const minorPath = `profiles/${prefix}-minor/legacy.jpg`;
    await env.withSecurityRulesDisabled(async () => {
      // An actual admin GCS write bypasses Storage Rules by design. For this
      // fixture use the local emulator bucket, never live credentials.
      await getAppBucket().file(minorPath).save(image);
    });
    await assertFails(user('another').ref(minorPath).getDownloadURL());
    await getAppBucket().file(minorPath).delete();
  });
  it('executes the retention worker against real emulator objects after 30 days', async () => {
    const bucket = getAppBucket();
    const photo = bucket.file(`verification/${prefix}/photo.jpg`);
    await photo.save(image);
    expect((await photo.exists())[0]).toBe(true);
    await deleteExpiredPhotoPage(bucket, new Date(Date.now() + PHOTO_RETENTION_MS + 1000));
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
