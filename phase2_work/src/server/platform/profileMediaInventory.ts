export type ProfileMediaInventoryUser = {
  uid: string;
  data: Record<string, unknown>;
};

export type ProfileMediaObjectInspection = {
  exists: boolean;
  hasFirebaseDownloadTokenMetadata: boolean;
  generation?: string;
  metageneration?: string;
};

export type ProfileMediaTokenInventorySummary = {
  readOnly: true;
  profileRecordsScanned: number;
  profileRecordsWithLegacyDownloadUrls: number;
  legacyDownloadUrlReferences: number;
  unresolvedLegacyDownloadUrls: number;
  profileMediaReferencesScanned: number;
  canonicalProfileMediaReferences: number;
  rawProfileMediaPathReferences: number;
  uniqueReferencedObjects: number;
  duplicateObjectReferences: number;
  referencedObjectsMissing: number;
  referencedObjectsWithFirebaseDownloadTokenMetadata: number;
  referencedObjectsWithoutFirebaseDownloadTokenMetadata: number;
  referencedObjectsWithVersionMetadata: number;
  referencedObjectsWithoutVersionMetadata: number;
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

const DOWNLOAD_URL_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);
const CANONICAL_PREFIX = 'klar-media:v1:';

function ownerScopedPath(uid: string, path: string): boolean {
  return Boolean(uid) && path.startsWith('profiles/' + uid + '/')
    && !path.includes('\\')
    && path.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

function canonicalObjectPath(uid: string, value: string): string | null {
  if (!value.startsWith(CANONICAL_PREFIX)) return null;
  const encoded = value.slice(CANONICAL_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const path = Buffer.from(encoded, 'base64url').toString('utf8');
    if (Buffer.from(path, 'utf8').toString('base64url') !== encoded || !ownerScopedPath(uid, path)) return null;
    return path;
  } catch {
    return null;
  }
}

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
  const marker = parsed.pathname.lastIndexOf('/o/');
  if (marker < 0) return false;
  let objectPath: string;
  try {
    objectPath = decodeURIComponent(parsed.pathname.slice(marker + 3));
  } catch {
    return false;
  }
  if (!ownerScopedPath(uid, objectPath)) return false;
  return objectPath;
}

function profileMediaValues(data: Record<string, unknown>): unknown[] {
  const values: unknown[] = [
    data.photoStoragePath,
    data.photoPath,
    data.photoURL,
    data.photoUrl,
  ];
  if (Array.isArray(data.photos)) values.push(...data.photos);
  return values;
}

/**
 * Read-only inventory over the profile-media aliases used by normalizeProfileMedia
 * and every object below profiles/. The result contains aggregate counts only:
 * no UID, URL, object path, token, generation, metageneration or raw metadata.
 */
export async function runProfileMediaTokenInventory(
  dependencies: ProfileMediaTokenInventoryDependencies,
  pageSize = 200,
): Promise<ProfileMediaTokenInventorySummary> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('Invalid inventory page size.');
  }

  let userCursor: unknown | undefined;
  let profileRecordsScanned = 0;
  let profileRecordsWithLegacyDownloadUrls = 0;
  let legacyDownloadUrlReferences = 0;
  let unresolvedLegacyDownloadUrls = 0;
  let profileMediaReferencesScanned = 0;
  let canonicalProfileMediaReferences = 0;
  let rawProfileMediaPathReferences = 0;
  const objectReferenceCounts = new Map<string, number>();

  for (;;) {
    const page = await dependencies.listUsersPage(userCursor, pageSize);
    if (!Array.isArray(page.users) || page.users.length > pageSize) {
      throw new Error('Invalid user inventory page.');
    }

    for (const user of page.users) {
      profileRecordsScanned++;
      let userHasLegacyDownloadUrl = false;

      for (const value of profileMediaValues(user.data)) {
        if (typeof value !== 'string' || value.length === 0) continue;
        const canonicalPath = canonicalObjectPath(user.uid, value);
        if (canonicalPath) {
          profileMediaReferencesScanned++;
          canonicalProfileMediaReferences++;
          objectReferenceCounts.set(canonicalPath, (objectReferenceCounts.get(canonicalPath) ?? 0) + 1);
          continue;
        }
        if (value.startsWith(CANONICAL_PREFIX)) {
          profileMediaReferencesScanned++;
          unresolvedLegacyDownloadUrls++;
          continue;
        }
        if (value.startsWith('profiles/')) {
          profileMediaReferencesScanned++;
          if (ownerScopedPath(user.uid, value)) {
            rawProfileMediaPathReferences++;
            objectReferenceCounts.set(value, (objectReferenceCounts.get(value) ?? 0) + 1);
          } else {
            unresolvedLegacyDownloadUrls++;
          }
          continue;
        }

        const objectPath = legacyProfileObjectPath(user.uid, value);
        if (objectPath === null) continue;
        profileMediaReferencesScanned++;
        userHasLegacyDownloadUrl = true;
        legacyDownloadUrlReferences++;
        if (objectPath === false) {
          unresolvedLegacyDownloadUrls++;
          continue;
        }
        objectReferenceCounts.set(objectPath, (objectReferenceCounts.get(objectPath) ?? 0) + 1);
      }

      if (userHasLegacyDownloadUrl) profileRecordsWithLegacyDownloadUrls++;
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
      if (!inspected.has(objectPath)) inspected.set(objectPath, await dependencies.inspectObject(objectPath));
    }

    if (!page.nextCursor) break;
    if (page.objectPaths.length === 0) throw new Error('Storage inventory pagination did not advance.');
    storageCursor = page.nextCursor;
  }

  let referencedObjectsMissing = 0;
  let referencedObjectsWithFirebaseDownloadTokenMetadata = 0;
  let referencedObjectsWithoutFirebaseDownloadTokenMetadata = 0;
  let referencedObjectsWithVersionMetadata = 0;
  let referencedObjectsWithoutVersionMetadata = 0;
  for (const objectPath of referencedObjectPaths) {
    const inspection = inspected.get(objectPath);
    if (!inspection || !inspection.exists) {
      referencedObjectsMissing++;
    } else {
      if (inspection.hasFirebaseDownloadTokenMetadata) referencedObjectsWithFirebaseDownloadTokenMetadata++;
      else referencedObjectsWithoutFirebaseDownloadTokenMetadata++;
      if (inspection.generation && inspection.metageneration) referencedObjectsWithVersionMetadata++;
      else referencedObjectsWithoutVersionMetadata++;
    }
  }

  let storageObjectsWithFirebaseDownloadTokenMetadata = 0;
  let storageObjectsWithoutFirebaseDownloadTokenMetadata = 0;
  for (const objectPath of storageObjectPaths) {
    const inspection = inspected.get(objectPath);
    if (!inspection || !inspection.exists) continue;
    if (inspection.hasFirebaseDownloadTokenMetadata) storageObjectsWithFirebaseDownloadTokenMetadata++;
    else storageObjectsWithoutFirebaseDownloadTokenMetadata++;
  }

  const uniqueReferencedObjects = objectReferenceCounts.size;
  const totalResolvedReferences = [...objectReferenceCounts.values()].reduce((sum, count) => sum + count, 0);

  return {
    readOnly: true,
    profileRecordsScanned,
    profileRecordsWithLegacyDownloadUrls,
    legacyDownloadUrlReferences,
    unresolvedLegacyDownloadUrls,
    profileMediaReferencesScanned,
    canonicalProfileMediaReferences,
    rawProfileMediaPathReferences,
    uniqueReferencedObjects,
    duplicateObjectReferences: totalResolvedReferences - uniqueReferencedObjects,
    referencedObjectsMissing,
    referencedObjectsWithFirebaseDownloadTokenMetadata,
    referencedObjectsWithoutFirebaseDownloadTokenMetadata,
    referencedObjectsWithVersionMetadata,
    referencedObjectsWithoutVersionMetadata,
    storageObjectsScanned: storageObjectPaths.size,
    storageObjectsWithFirebaseDownloadTokenMetadata,
    storageObjectsWithoutFirebaseDownloadTokenMetadata,
    orphanedStorageObjects: [...storageObjectPaths].filter(path => !referencedObjectPaths.has(path)).length,
  };
}
