import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { runProfileMediaTokenInventory } from '../src/server/platform/profileMediaInventory';

function option(name: string): string | undefined {
  const prefix = name + '=';
  const inline = process.argv.slice(2).find(argument => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function configureReadOnlyTarget(): { mode: 'emulator' | 'live-read-only'; projectId: string; bucketName: string } {
  if (hasFlag('--emulator')) {
    const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST;
    const firebaseStorageEmulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-klar';
    if (!firestoreEmulator || !firebaseStorageEmulator || !projectId.startsWith('demo-')) {
      throw new Error('Emulator mode requires Firestore and Firebase Storage emulator hosts and a demo-* project.');
    }
    process.env.GCLOUD_PROJECT = projectId;
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    if (!process.env.STORAGE_EMULATOR_HOST) {
      process.env.STORAGE_EMULATOR_HOST = firebaseStorageEmulator.startsWith('http')
        ? firebaseStorageEmulator
        : 'http://' + firebaseStorageEmulator;
    }
    return { mode: 'emulator', projectId, bucketName: projectId + '.appspot.com' };
  }

  if (!hasFlag('--live-read-only') || !hasFlag('--confirm-live-read-only')) {
    throw new Error('Select --emulator, or explicitly pass --live-read-only --confirm-live-read-only.');
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST) {
    throw new Error('Live read-only mode refuses an emulator-configured environment.');
  }
  const projectId = option('--project-id');
  const bucketName = option('--bucket');
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || !bucketName || bucketName.includes('/') || /\s/.test(bucketName)) {
    throw new Error('Live read-only mode requires a valid --project-id and --bucket.');
  }
  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.FIREBASE_STORAGE_BUCKET = bucketName;
  return { mode: 'live-read-only', projectId, bucketName };
}

async function main(): Promise<void> {
  const target = configureReadOnlyTarget();
  const [{ getDb }, { getAppBucket }, { FieldPath }] = await Promise.all([
    import('../src/server/db'),
    import('../src/server/storage'),
    import('firebase-admin/firestore'),
  ]);
  const db = getDb() as Firestore;
  const bucket = getAppBucket() as Bucket;

  const summary = await runProfileMediaTokenInventory({
    listUsersPage: async (cursor, pageSize) => {
      const collections = ['users', 'public_profiles'] as const;
      const state = cursor as { sourceIndex: number; lastDocument?: import('firebase-admin/firestore').QueryDocumentSnapshot } | undefined;
      let sourceIndex = state?.sourceIndex ?? 0;
      let lastDocument = state?.lastDocument;
      const users: Array<{ uid: string; data: Record<string, unknown> }> = [];

      while (sourceIndex < collections.length && users.length < pageSize) {
        const remaining = pageSize - users.length;
        let query = db.collection(collections[sourceIndex]!).orderBy(FieldPath.documentId()).limit(remaining);
        if (lastDocument) query = query.startAfter(lastDocument);
        const snapshot = await query.get();
        users.push(...snapshot.docs.map(document => ({
          uid: document.id,
          data: document.data() as Record<string, unknown>,
        })));

        if (snapshot.docs.length === remaining && snapshot.docs.length > 0) {
          const last = snapshot.docs[snapshot.docs.length - 1];
          return { users, nextCursor: { sourceIndex, lastDocument: last } };
        }
        sourceIndex++;
        lastDocument = undefined;
      }
      return { users };
    },
    listProfileObjectsPage: async (cursor, pageSize) => {
      const [files, next] = await bucket.getFiles({
        prefix: 'profiles/',
        maxResults: pageSize,
        autoPaginate: false,
        ...(cursor ? { pageToken: String(cursor) } : {}),
      });
      return {
        objectPaths: files.map(file => file.name),
        ...(next?.pageToken ? { nextCursor: next.pageToken } : {}),
      };
    },
    inspectObject: async objectPath => {
      try {
        const [metadata] = await bucket.file(objectPath).getMetadata();
        const customMetadata = metadata.metadata && typeof metadata.metadata === 'object'
          ? metadata.metadata as Record<string, unknown>
          : {};
        const tokenMetadata = customMetadata.firebaseStorageDownloadTokens;
        return {
          exists: true,
          hasFirebaseDownloadTokenMetadata: typeof tokenMetadata === 'string' && tokenMetadata.trim().length > 0,
        };
      } catch (error) {
        if ((error as { code?: number }).code === 404) {
          return { exists: false, hasFirebaseDownloadTokenMetadata: false };
        }
        // Do not print SDK errors: messages may contain bucket/object details.
        throw new Error('Storage metadata read failed.');
      }
    },
  });

  // Counts only. Never print profile IDs, object paths, download URLs, token
  // values, raw metadata, credentials, or full SDK exceptions.
  console.log(JSON.stringify({
    mode: target.mode,
    projectId: target.projectId,
    bucket: target.bucketName,
    inventory: summary,
  }, null, 2));
}

main().catch(() => {
  console.error('Profile-media token inventory failed. No changes were requested or performed.');
  process.exitCode = 1;
});
