export type ProfileMediaInventoryUser = {
  uid: string;
  data: Record<string, unknown>;
};

export type ProfileMediaObjectInspection = {
  exists: boolean;
  hasFirebaseDownloadTokenMetadata: boolean;
};

export type ProfileMediaTokenInventorySummary = {
  readOnly: true;
  usersScanned: number;
  usersWithLegacyDownloadUrls: number;
  legacyDownloadUrlReferences: number;
  unresolvedLegacyDownloadUrls: number;
  uniqueReferencedObjects: number;
  duplicateObjectReferences: number;
  referencedObjectsMissing: number;
  referencedObjectsWithFirebaseDownloadTokenMetadata: number;
  referencedObjectsWithoutFirebaseDownloadTokenMetadata: number;
  storageObjectsScanned: number;
  storageObjectsWithFirebaseDownloadTokenMetadata: number;
  storageObjectsWithoutFirebaseDownloadTokenMetadata: number;
  orphanedStorageObjects: number;
};

export type ProfileMediaTokenInventoryDependencies = {
  listUsersPage: (cursor: unknown | undefined, pageSize: number) => Promise<{
    users: ProfileMediaInventoryUser[];
    nextCursor?: unknown;
  }>;
  listProfileObjectsPage: (cursor: unknown | undefined, pageSize: number) => Promise<{
    objectPaths: string[];
    nextCursor?: unknown;
  }>;
  inspectObject: (objectPath: string) => Promise<ProfileMediaObjectInspection>;
};

const DOWNLOAD_URL_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function legacyProfileObjectPath(uid: string, value: unknown): string | null | false {
  if (typeof value !== 'string') return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!DOWNLOAD_URL_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const token = parsed.searchParams.get('token');
  if (!token) return null;

  const marker = parsed.pathname.indexOf('/o/');
  if (marker < 0) return false;

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(parsed.pathname.slice(marker + 3));
  } catch {
    return false;
  }

  if (!uid || !objectPath.startsWith('profiles/' + uid + '/')
    || objectPath.split('/').some(segment => !segment || segment === '.' || segment === '..')
    || objectPath.includes('\\')) {
    return false;
  }
  return objectPath;
}

function profileMediaValues(data: Record<string, unknown>): unknown[] {
  const values: unknown[] = [data.photoURL, data.photoUrl];
  if (Array.isArray(data.photos)) values.push(...data.photos);
  return values;
}

/**
 * Read-only inventory over Firestore profile aliases and every object below
 * profiles/. The dependency surface contains list/get operations only.
 * The result is counts only: no UID, URL, object path, token or metadata value.
 */
export async function runProfileMediaTokenInventory(
  dependencies: ProfileMediaTokenInventoryDependencies,
  pageSize = 200,
): Promise<ProfileMediaTokenInventorySummary> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('Invalid inventory page size.');
  }

  let userCursor: unknown | undefined;
  let usersScanned = 0;
  let usersWithLegacyDownloadUrls = 0;
  let legacyDownloadUrlReferences = 0;
  let unresolvedLegacyDownloadUrls = 0;
  const objectReferenceCounts = new Map<string, number>();

  for (;;) {
    const page = await dependencies.listUsersPage(userCursor, pageSize);
    if (!Array.isArray(page.users) || page.users.length > pageSize) {
      throw new Error('Invalid user inventory page.');
    }

    for (const user of page.users) {
      usersScanned++;
      let userHasLegacyDownloadUrl = false;

      for (const value of profileMediaValues(user.data)) {
        const objectPath = legacyProfileObjectPath(user.uid, value);
        if (objectPath === null) continue;
        userHasLegacyDownloadUrl = true;
        legacyDownloadUrlReferences++;

        if (objectPath === false) {
          unresolvedLegacyDownloadUrls++;
          continue;
        }
        objectReferenceCounts.set(objectPath, (objectReferenceCounts.get(objectPath) ?? 0) + 1);
      }

      if (userHasLegacyDownloadUrl) usersWithLegacyDownloadUrls++;
    }

    if (!page.nextCursor) break;
    if (page.users.length === 0) throw new Error('User inventory pagination did not advance.');
    userCursor = page.nextCursor;
  }

  const referencedObjectPaths = new Set(objectReferenceCounts.keys());
  const inspected = new Map<string, ProfileMediaObjectInspection>();
  for (const objectPath of referencedObjectPaths) {
    inspected.set(objectPath, await dependencies.inspectObject(objectPath));
  }

  const storageObjectPaths = new Set<string>();
  let storageCursor: unknown | undefined;
  for (;;) {
    const page = await dependencies.listProfileObjectsPage(storageCursor, pageSize);
    if (!Array.isArray(page.objectPaths) || page.objectPaths.length > pageSize) {
      throw new Error('Invalid Storage inventory page.');
    }

    for (const objectPath of page.objectPaths) {
      if (typeof objectPath !== 'string' || !objectPath.startsWith('profiles/')
        || objectPath.includes('\\') || objectPath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
        continue;
      }
      storageObjectPaths.add(objectPath);
      if (!inspected.has(objectPath)) {
        inspected.set(objectPath, await dependencies.inspectObject(objectPath));
      }
    }

    if (!page.nextCursor) break;
    if (page.objectPaths.length === 0) throw new Error('Storage inventory pagination did not advance.');
    storageCursor = page.nextCursor;
  }

  let referencedObjectsMissing = 0;
  let referencedObjectsWithFirebaseDownloadTokenMetadata = 0;
  let referencedObjectsWithoutFirebaseDownloadTokenMetadata = 0;
  for (const objectPath of referencedObjectPaths) {
    const inspection = inspected.get(objectPath);
    if (!inspection || !inspection.exists) {
      referencedObjectsMissing++;
    } else if (inspection.hasFirebaseDownloadTokenMetadata) {
      referencedObjectsWithFirebaseDownloadTokenMetadata++;
    } else {
      referencedObjectsWithoutFirebaseDownloadTokenMetadata++;
    }
  }

  let storageObjectsWithFirebaseDownloadTokenMetadata = 0;
  let storageObjectsWithoutFirebaseDownloadTokenMetadata = 0;
  for (const objectPath of storageObjectPaths) {
    const inspection = inspected.get(objectPath);
    if (!inspection || !inspection.exists) continue;
    if (inspection.hasFirebaseDownloadTokenMetadata) {
      storageObjectsWithFirebaseDownloadTokenMetadata++;
    } else {
      storageObjectsWithoutFirebaseDownloadTokenMetadata++;
    }
  }

  const uniqueReferencedObjects = objectReferenceCounts.size;
  const totalResolvedReferences = [...objectReferenceCounts.values()].reduce((sum, count) => sum + count, 0);

  return {
    readOnly: true,
    usersScanned,
    usersWithLegacyDownloadUrls,
    legacyDownloadUrlReferences,
    unresolvedLegacyDownloadUrls,
    uniqueReferencedObjects,
    duplicateObjectReferences: totalResolvedReferences - uniqueReferencedObjects,
    referencedObjectsMissing,
    referencedObjectsWithFirebaseDownloadTokenMetadata,
    referencedObjectsWithoutFirebaseDownloadTokenMetadata,
    storageObjectsScanned: storageObjectPaths.size,
    storageObjectsWithFirebaseDownloadTokenMetadata,
    storageObjectsWithoutFirebaseDownloadTokenMetadata,
    orphanedStorageObjects: [...storageObjectPaths].filter(path => !referencedObjectPaths.has(path)).length,
  };
}
