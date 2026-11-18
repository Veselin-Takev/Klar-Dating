// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import { runProfileMediaTokenInventory } from '../src/server/platform/profileMediaInventory';

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
const emulatorEnabled = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST
  && process.env.FIREBASE_STORAGE_EMULATOR_HOST
  && projectId.startsWith('demo-'),
);

const uid = 'inventory-' + crypto.randomUUID();
const referencedWithToken = 'profiles/' + uid + '/with-token.jpg';
const referencedWithoutToken = 'profiles/' + uid + '/without-token.webp';
const orphanWithToken = 'profiles/' + uid + '/orphan.jpg';
const tokenUrl = (path: string, token: string) =>
  'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/' +
  encodeURIComponent(path) + '?alt=media&token=' + token;

describe.runIf(emulatorEnabled)('profile media inventory against Firebase emulators', () => {
  const db = getDb();
  const bucket = getAppBucket();

  afterAll(async () => {
    await Promise.all([
      db.collection('users').doc(uid).delete(),
      db.collection('public_profiles').doc(uid).delete(),
      bucket.file(referencedWithToken).delete({ ignoreNotFound: true }),
      bucket.file(referencedWithoutToken).delete({ ignoreNotFound: true }),
      bucket.file(orphanWithToken).delete({ ignoreNotFound: true }),
    ]);
  });

  it('counts Firestore aliases, inspects Storage custom metadata and identifies an orphan without exposing token values', async () => {
    await db.collection('users').doc(uid).set({
      photoURL: tokenUrl(referencedWithToken, 'emulator-user-token'),
      photos: [tokenUrl(referencedWithToken, 'emulator-user-token')],
    });
    await db.collection('public_profiles').doc(uid).set({
      photoUrl: tokenUrl(referencedWithoutToken, 'emulator-public-token'),
    });

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    await bucket.file(referencedWithToken).save(bytes, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: 'emulator-only-download-token' },
      },
    });
    await bucket.file(referencedWithoutToken).save(bytes, {
      metadata: { contentType: 'image/webp' },
    });
    await bucket.file(orphanWithToken).save(bytes, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: 'orphan-emulator-token' },
      },
    });

    const userSnapshot = await db.collection('users').doc(uid).get();
    const publicSnapshot = await db.collection('public_profiles').doc(uid).get();
    expect(userSnapshot.exists).toBe(true);
    expect(publicSnapshot.exists).toBe(true);

    const summary = await runProfileMediaTokenInventory({
      listUsersPage: async () => ({
        users: [
          { uid, data: userSnapshot.data() as Record<string, unknown> },
          { uid, data: publicSnapshot.data() as Record<string, unknown> },
        ],
      }),
      listProfileObjectsPage: async cursor => {
        const [files, next] = await bucket.getFiles({
          prefix: 'profiles/' + uid + '/',
          maxResults: 100,
          autoPaginate: false,
          ...(cursor ? { pageToken: String(cursor) } : {}),
        });
        return {
          objectPaths: files.map(file => file.name),
          ...(next?.pageToken ? { nextCursor: next.pageToken } : {}),
        };
      },
      inspectObject: async objectPath => {
        const [metadata] = await bucket.file(objectPath).getMetadata();
        const customMetadata = metadata.metadata && typeof metadata.metadata === 'object'
          ? metadata.metadata as Record<string, unknown>
          : {};
        const tokenMetadata = customMetadata.firebaseStorageDownloadTokens;
        return {
          exists: true,
          hasFirebaseDownloadTokenMetadata: typeof tokenMetadata === 'string' && tokenMetadata.length > 0,
        };
      },
    });

    expect(summary).toMatchObject({
      readOnly: true,
      usersScanned: 2,
      usersWithLegacyDownloadUrls: 2,
      legacyDownloadUrlReferences: 3,
      unresolvedLegacyDownloadUrls: 0,
      uniqueReferencedObjects: 2,
      duplicateObjectReferences: 1,
      referencedObjectsMissing: 0,
      referencedObjectsWithFirebaseDownloadTokenMetadata: 1,
      referencedObjectsWithoutFirebaseDownloadTokenMetadata: 1,
      storageObjectsScanned: 3,
      storageObjectsWithFirebaseDownloadTokenMetadata: 2,
      storageObjectsWithoutFirebaseDownloadTokenMetadata: 1,
      orphanedStorageObjects: 1,
    });
    const output = JSON.stringify(summary);
    expect(output).not.toContain('emulator-user-token');
    expect(output).not.toContain('emulator-public-token');
    expect(output).not.toContain('emulator-only-download-token');
    expect(output).not.toContain('orphan-emulator-token');
    expect(output).not.toContain(uid);
  });
});
