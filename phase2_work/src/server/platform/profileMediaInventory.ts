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
  objectsInspected: number;
  objectsMissing: number;
  objectsWithFirebaseDownloadTokenMetadata: number;
  objectsWithoutFirebaseDownloadTokenMetadata: number;
};

export type ProfileMediaTokenInventoryDependencies = {
  listUsersPage: (cursor: unknown | undefined, pageSize: number) => Promise<{
    users: ProfileMediaInventoryUser[];
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
 * Read-only inventory over Firestore profile aliases and referenced Storage
 * object metadata. This function intentionally has no mutation dependency.
 * It returns counts only: no UID, URL, object path, token or metadata values.
 */
export async function runProfileMediaTokenInventory(
  dependencies: ProfileMediaTokenInventoryDependencies,
  pageSize = 200,
): Promise<ProfileMediaTokenInventorySummary> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('Invalid inventory page size.');
  }

  let cursor: unknown | undefined;
  let usersScanned = 0;
  let usersWithLegacyDownloadUrls = 0;
  let legacyDownloadUrlReferences = 0;
  let unresolvedLegacyDownloadUrls = 0;
  const objectReferenceCounts = new Map<string, number>();

  for (;;) {
    const page = await dependencies.listUsersPage(cursor, pageSize);
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
    if (page.users.length === 0) throw new Error('Inventory pagination did not advance.');
    cursor = page.nextCursor;
  }

  let objectsMissing = 0;
  let objectsWithFirebaseDownloadTokenMetadata = 0;
  let objectsWithoutFirebaseDownloadTokenMetadata = 0;

  for (const objectPath of objectReferenceCounts.keys()) {
    const inspection = await dependencies.inspectObject(objectPath);
    if (!inspection.exists) {
      objectsMissing++;
      continue;
    }
    if (inspection.hasFirebaseDownloadTokenMetadata) {
      objectsWithFirebaseDownloadTokenMetadata++;
    } else {
      objectsWithoutFirebaseDownloadTokenMetadata++;
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
    objectsInspected: uniqueReferencedObjects,
    objectsMissing,
    objectsWithFirebaseDownloadTokenMetadata,
    objectsWithoutFirebaseDownloadTokenMetadata,
  };
}
