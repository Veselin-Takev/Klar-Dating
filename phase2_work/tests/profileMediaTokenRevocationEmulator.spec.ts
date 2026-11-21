// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { getDb } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import {
  createProfileMediaTokenRevocationPlan,
  executeProfileMediaTokenRevocation,
} from '../src/server/platform/profileMediaTokenRevocation';
import { createCanonicalMediaRef, createProfileMediaRouter } from '../src/server/platform/profileMedia';

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
const emulatorEnabled = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST
  && process.env.FIREBASE_STORAGE_EMULATOR_HOST
  && projectId.startsWith('demo-'),
);
const uid = 'media-revoke-' + crypto.randomUUID();
const viewerUid = uid + '-viewer';
const objectPath = `profiles/${uid}/avatar.jpg`;
const manifestDigest = 'd'.repeat(64);
const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];

describe.runIf(emulatorEnabled)('profile media token revocation against Firebase emulators', () => {
  const db = getDb();
  const bucket = getAppBucket();
  const file = bucket.file(objectPath);

  afterAll(async () => {
    await Promise.all([
      db.collection('users').doc(uid).delete(),
      db.collection('users').doc(viewerUid).delete(),
      db.collection('account_deletions').doc(uid).delete(),
      db.collection('account_deletions').doc(viewerUid).delete(),
      file.delete({ ignoreNotFound: true }),
    ]);
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  });

  async function readMetadata(path: string) {
    try {
      const [metadata] = await bucket.file(path).getMetadata();
      return {
        exists: true,
        generation: String(metadata.generation),
        metageneration: String(metadata.metageneration),
        customMetadata: metadata.metadata && typeof metadata.metadata === 'object'
          ? metadata.metadata as Record<string, string | undefined>
          : {},
      };
    } catch (error) {
      if ((error as { code?: number }).code === 404) return { exists: false };
      throw error;
    }
  }

  it('dry-run reports the approved cohort and performs zero metadata mutations', async () => {
    await file.save(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]), {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: 'emulator-revoke-token', preserveMe: 'preserved' },
      },
    });
    const current = await readMetadata(objectPath);
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath,
      generation: current.generation!,
      metageneration: current.metageneration!,
    }], readMetadata, manifestDigest);
    const afterDryRun = await readMetadata(objectPath);
    expect(plan.summary).toMatchObject({ selected: 1, eligible: 1, tokenMetadataPresent: 1 });
    expect(afterDryRun.customMetadata?.firebaseStorageDownloadTokens).toBe('emulator-revoke-token');
    expect(afterDryRun.customMetadata?.preserveMe).toBe('preserved');
    expect(JSON.stringify(plan.summary)).not.toContain(uid);
  });

  it('revokes only the Firebase token key with a metageneration precondition and keeps the proxy working', async () => {
    await file.save(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x02]), {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: 'emulator-proxy-token', preserveMe: 'keep-this' },
      },
    });
    await db.collection('users').doc(uid).set({
      isAdult: true, active: true, isSuspended: false, isBlocked: false, deletionPending: false,
    });
    await db.collection('users').doc(viewerUid).set({
      isAdult: true, active: true, isSuspended: false, isBlocked: false, deletionPending: false,
    });
    const before = await readMetadata(objectPath);
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath,
      generation: before.generation!,
      metageneration: before.metageneration!,
    }], readMetadata, manifestDigest);
    let postPatchMetadata: Awaited<ReturnType<typeof readMetadata>> | undefined;
    let result;
    try {
      result = await executeProfileMediaTokenRevocation(plan, {
        readMetadata,
        patchCustomMetadata: async (path, patch, options) => {
          await bucket.file(path).setMetadata(
            { metadata: { firebaseStorageDownloadTokens: patch.firebaseStorageDownloadTokens } },
            { ifMetagenerationMatch: Number(options.ifMetagenerationMatch) },
          );
          postPatchMetadata = await readMetadata(path);
        },
      });
    } catch (error) {
      const metadata = postPatchMetadata?.customMetadata ?? {};
      const hasTokenKey = Object.prototype.hasOwnProperty.call(metadata, 'firebaseStorageDownloadTokens');
      const tokenValue = metadata.firebaseStorageDownloadTokens;
      throw new Error(
        'Revocation emulator diagnostic (values redacted): ' + JSON.stringify({
          before: { generation: before.generation, metageneration: before.metageneration },
          after: {
            exists: postPatchMetadata?.exists,
            generation: postPatchMetadata?.generation,
            metageneration: postPatchMetadata?.metageneration,
            customMetadataKeys: Object.keys(metadata).sort(),
            tokenKeyState: !hasTokenKey ? 'absent' : tokenValue === null ? 'null' : tokenValue === 'null' ? 'literal-null-string' : typeof tokenValue === 'string' ? 'string-present' : 'unexpected-type',
            tokenValueMatchesFixture: tokenValue === 'emulator-proxy-token',
            preserveMe: metadata.preserveMe,
          },
          cause: error instanceof Error ? error.message : 'unknown failure',
        }),
      );
    }
    const after = await readMetadata(objectPath);
    expect(result).toMatchObject({ revoked: 1, conflicts: 0, stopped: false });
    expect(after.customMetadata?.firebaseStorageDownloadTokens).toBeUndefined();
    expect(after.customMetadata?.preserveMe).toBe('keep-this');

    const app = express();
    app.use('/api', createProfileMediaRouter({
      getFirestore: () => db,
      getAuth: () => ({
        verifyIdToken: async (token: string, checkRevoked: boolean) => {
          if (token !== 'emulator-auth-token' || checkRevoked !== true) throw new Error('invalid test token');
          return { uid: viewerUid, firebase: { sign_in_provider: 'password' } };
        },
      }) as never,
      getBucket: () => bucket,
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const canonical = createCanonicalMediaRef(uid, objectPath);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/profile-media/${uid}/${encodeURIComponent(canonical)}`;
    const response = await fetch(url, { headers: { Authorization: 'Bearer emulator-auth-token' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x02]));
  });

  it('stops safely when the object metageneration changed after the manifest was approved', async () => {
    await file.save(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x03]), {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: 'stale-token', preserveMe: 'before' },
      },
    });
    const before = await readMetadata(objectPath);
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath,
      generation: before.generation!,
      metageneration: before.metageneration!,
    }], readMetadata, manifestDigest);
    await file.setMetadata({ metadata: { preserveMe: 'after' } });
    const patch = async (path: string, update: { firebaseStorageDownloadTokens: null }, options: { ifMetagenerationMatch: string }) => {
      await bucket.file(path).setMetadata({ metadata: { firebaseStorageDownloadTokens: update.firebaseStorageDownloadTokens } } as never, {
        ifMetagenerationMatch: Number(options.ifMetagenerationMatch),
      });
    };
    const result = await executeProfileMediaTokenRevocation(plan, {
      readMetadata,
      patchCustomMetadata: patch,
    });
    const after = await readMetadata(objectPath);
    expect(result).toMatchObject({ revoked: 0, conflicts: 1, stopped: true });
    expect(after.customMetadata?.firebaseStorageDownloadTokens).toBe('stale-token');
    expect(after.customMetadata?.preserveMe).toBe('after');
  });
});
