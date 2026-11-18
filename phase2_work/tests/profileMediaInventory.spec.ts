// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runProfileMediaTokenInventory, type ProfileMediaObjectInspection } from '../src/server/platform/profileMediaInventory';

const storageUrl = (objectPath: string, token: string) =>
  'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/' +
  encodeURIComponent(objectPath) + '?alt=media&token=' + token;

describe('read-only legacy profile media token inventory', () => {
  it('counts user URL aliases, inspects referenced and unreferenced object metadata, and emits counts only', async () => {
    const objectA = 'profiles/user-a/avatar-a.jpg';
    const objectB = 'profiles/user-a/avatar-b.webp';
    const missingObject = 'profiles/user-b/missing.jpg';
    const orphanObject = 'profiles/deleted-user/orphan.jpg';
    const inspectedPaths: string[] = [];
    let userPage = 0;
    let storagePage = 0;

    const metadataByPath = new Map<string, ProfileMediaObjectInspection>([
      [objectA, { exists: true, hasFirebaseDownloadTokenMetadata: true }],
      [objectB, { exists: true, hasFirebaseDownloadTokenMetadata: false }],
      [missingObject, { exists: false, hasFirebaseDownloadTokenMetadata: false }],
      [orphanObject, { exists: true, hasFirebaseDownloadTokenMetadata: true }],
    ]);

    const listUsersPage = vi.fn(async (cursor: unknown, pageSize: number) => {
      expect(pageSize).toBe(1);
      if (!cursor && userPage++ === 0) {
        return {
          users: [{
            uid: 'user-a',
            data: {
              photoURL: storageUrl(objectA, 'token-a'),
              photos: [storageUrl(objectA, 'token-a'), storageUrl(objectB, 'token-b')],
              bio: 'must-not-be-returned',
            },
          }],
          nextCursor: 'user-a-cursor',
        };
      }
      if (cursor === 'user-a-cursor') {
        return {
          users: [{ uid: 'user-b', data: { photoUrl: storageUrl(missingObject, 'token-c') } }],
        };
      }
      return { users: [] };
    });

    const listProfileObjectsPage = vi.fn(async (cursor: unknown, pageSize: number) => {
      expect(pageSize).toBe(1);
      if (!cursor && storagePage++ === 0) {
        return { objectPaths: [objectA], nextCursor: 'storage-page-1' };
      }
      if (cursor === 'storage-page-1') {
        return { objectPaths: [objectB], nextCursor: 'storage-page-2' };
      }
      if (cursor === 'storage-page-2') {
        return { objectPaths: [orphanObject] };
      }
      return { objectPaths: [] };
    });

    const inspectObject = vi.fn(async (objectPath: string) => {
      inspectedPaths.push(objectPath);
      return metadataByPath.get(objectPath) ?? { exists: false, hasFirebaseDownloadTokenMetadata: false };
    });

    const result = await runProfileMediaTokenInventory({
      listUsersPage,
      listProfileObjectsPage,
      inspectObject,
    }, 1);

    expect(result).toEqual({
      readOnly: true,
      profileRecordsScanned: 2,
      profileRecordsWithLegacyDownloadUrls: 2,
      legacyDownloadUrlReferences: 4,
      unresolvedLegacyDownloadUrls: 0,
      uniqueReferencedObjects: 3,
      duplicateObjectReferences: 1,
      referencedObjectsMissing: 1,
      referencedObjectsWithFirebaseDownloadTokenMetadata: 1,
      referencedObjectsWithoutFirebaseDownloadTokenMetadata: 1,
      storageObjectsScanned: 3,
      storageObjectsWithFirebaseDownloadTokenMetadata: 2,
      storageObjectsWithoutFirebaseDownloadTokenMetadata: 1,
      orphanedStorageObjects: 1,
    });
    expect(new Set(inspectedPaths)).toEqual(new Set([objectA, objectB, missingObject, orphanObject]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('token-a');
    expect(serialized).not.toContain('token-b');
    expect(serialized).not.toContain('token-c');
    expect(serialized).not.toContain('user-a');
    expect(serialized).not.toContain('avatar-a.jpg');
    expect(listUsersPage).toHaveBeenCalledTimes(2);
    expect(listProfileObjectsPage).toHaveBeenCalledTimes(3);
  });

  it('counts a token URL with an invalid owner path as unresolved and ignores non-Firebase hosts', async () => {
    const result = await runProfileMediaTokenInventory({
      listUsersPage: async () => ({
        users: [{
          uid: 'user-a',
          data: {
            photoURL: storageUrl('profiles/user-b/photo.jpg', 'secret-token'),
            photoUrl: 'https://example.invalid/v0/b/bucket/o/profiles%2Fuser-a%2Fphoto.jpg?token=ignored',
          },
        }],
      }),
      listProfileObjectsPage: async () => ({ objectPaths: [] }),
      inspectObject: async () => ({ exists: false, hasFirebaseDownloadTokenMetadata: false }),
    });

    expect(result.legacyDownloadUrlReferences).toBe(1);
    expect(result.unresolvedLegacyDownloadUrls).toBe(1);
    expect(result.uniqueReferencedObjects).toBe(0);
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('fails closed on invalid page sizes and stalled pagination', async () => {
    await expect(runProfileMediaTokenInventory({
      listUsersPage: async () => ({ users: [], nextCursor: 'stuck' }),
      listProfileObjectsPage: async () => ({ objectPaths: [] }),
      inspectObject: async () => ({ exists: false, hasFirebaseDownloadTokenMetadata: false }),
    }, 0)).rejects.toThrow('Invalid inventory page size.');

    await expect(runProfileMediaTokenInventory({
      listUsersPage: async () => ({ users: [], nextCursor: 'stuck' }),
      listProfileObjectsPage: async () => ({ objectPaths: [] }),
      inspectObject: async () => ({ exists: false, hasFirebaseDownloadTokenMetadata: false }),
    }, 10)).rejects.toThrow('User inventory pagination did not advance.');
  });
});
