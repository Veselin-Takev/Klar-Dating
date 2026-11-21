import { createHash } from 'node:crypto';
import { createCanonicalMediaRef, parseCanonicalMediaRef } from './profileMedia';

export const PROFILE_MEDIA_MIGRATION_FIELDS = ['photoStoragePath', 'photoPath', 'photoURL', 'photoUrl'] as const;
const DOWNLOAD_URL_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const OBJECT_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;

export type ProfileMediaCollection = 'users' | 'public_profiles';
export type ProfileMediaMigrationRecord = {
  collection: ProfileMediaCollection;
  uid: string;
  data: Record<string, unknown>;
};
export type ProfileMediaMigrationObject = {
  exists: boolean;
  generation?: string;
  metageneration?: string;
  contentType?: string;
  size?: number;
};
export type ProfileMediaMigrationInspection = (objectPath: string) => Promise<ProfileMediaMigrationObject>;
type ParsedValue =
  | { kind: 'empty' }
  | { kind: 'canonical' | 'path' | 'legacy-url'; objectPath: string }
  | { kind: 'malformed-url' | 'unsupported-host' | 'unsupported-bucket' | 'wrong-owner' | 'invalid-reference' };

export type ProfileMediaMigrationAction = {
  collection: ProfileMediaCollection;
  uid: string;
  expectedAliasSnapshotHash: string;
  updates: Record<string, unknown>;
  objectVersions: Array<{ objectPath: string; generation: string; metageneration: string }>;
};
export type ProfileMediaMigrationSummary = {
  profilesScanned: number;
  actionsPlanned: number;
  alreadyCanonical: number;
  noMedia: number;
  conflictingAliases: number;
  malformedUrls: number;
  unsupportedHosts: number;
  unsupportedBuckets: number;
  wrongOwnerPaths: number;
  invalidReferences: number;
  missingObjects: number;
  invalidObjects: number;
  unresolvedProfiles: number;
};
export type ProfileMediaMigrationPlan = {
  version: 1;
  manifestDigest: string;
  planDigest: string;
  summary: ProfileMediaMigrationSummary;
  actions: ProfileMediaMigrationAction[];
};
export type ProfileMediaMigrationCheckpoint = {
  version: 1;
  planDigest: string;
  nextIndex: number;
  updated: number;
  alreadyApplied: number;
};
export type ProfileMediaMigrationBatchResult = {
  checkpoint: ProfileMediaMigrationCheckpoint;
  processedThisRun: number;
  conflicts: number;
  complete: boolean;
  stoppedOnConflict: boolean;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function ownerScopedPath(uid: string, path: string): boolean {
  return UID_PATTERN.test(uid)
    && path.startsWith('profiles/' + uid + '/')
    && OBJECT_PATH_PATTERN.test(path)
    && !path.includes('\\')
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

function parseValue(uid: string, value: unknown, allowRawPath: boolean, expectedBucketName?: string): ParsedValue {
  if (value === undefined || value === null || value === '') return { kind: 'empty' };
  if (typeof value !== 'string') return { kind: 'invalid-reference' };
  const canonicalPath = parseCanonicalMediaRef(uid, value);
  if (canonicalPath) return { kind: 'canonical', objectPath: canonicalPath };
  if (value.startsWith('klar-media:v1:')) return { kind: 'invalid-reference' };
  if (value.startsWith('profiles/')) {
    if (!allowRawPath) return { kind: 'invalid-reference' };
    return ownerScopedPath(uid, value)
      ? { kind: 'path', objectPath: value }
      : { kind: 'wrong-owner' };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value.includes('://') || value.startsWith('http')
      ? { kind: 'malformed-url' }
      : { kind: 'invalid-reference' };
  }
  if (!DOWNLOAD_URL_HOSTS.has(parsed.hostname.toLowerCase())
      || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
    return { kind: 'unsupported-host' };
  }
  const tokens = parsed.searchParams.getAll('token');
  if (tokens.length !== 1 || !tokens[0]?.trim()) return { kind: 'malformed-url' };
  const marker = parsed.pathname.lastIndexOf('/o/');
  const bucketMarker = parsed.pathname.lastIndexOf('/b/', marker);
  if (marker < 0 || bucketMarker < 0 || bucketMarker >= marker) return { kind: 'malformed-url' };
  const urlBucketName = parsed.pathname.slice(bucketMarker + 3, marker);
  if (!urlBucketName || urlBucketName.includes('/')) return { kind: 'malformed-url' };
  if (expectedBucketName && urlBucketName !== expectedBucketName) return { kind: 'unsupported-bucket' };
  let objectPath: string;
  try {
    objectPath = decodeURIComponent(parsed.pathname.slice(marker + 3));
  } catch {
    return { kind: 'malformed-url' };
  }
  if (!ownerScopedPath(uid, objectPath)) return { kind: 'wrong-owner' };
  return { kind: 'legacy-url', objectPath };
}

function aliasSnapshot(data: Record<string, unknown>): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of [...PROFILE_MEDIA_MIGRATION_FIELDS, 'photos']) {
    if (Object.prototype.hasOwnProperty.call(data, field)) snapshot[field] = data[field];
  }
  return snapshot;
}

export function profileMediaAliasSnapshotHash(data: Record<string, unknown>): string {
  return hash(JSON.stringify(aliasSnapshot(data)));
}

function canonicalFor(uid: string, objectPath: string): string {
  return createCanonicalMediaRef(uid, objectPath);
}

function countIssue(summary: ProfileMediaMigrationSummary, item: ParsedValue): void {
  switch (item.kind) {
    case 'malformed-url': summary.malformedUrls++; break;
    case 'unsupported-host': summary.unsupportedHosts++; break;
    case 'unsupported-bucket': summary.unsupportedBuckets++; break;
    case 'wrong-owner': summary.wrongOwnerPaths++; break;
    case 'invalid-reference': summary.invalidReferences++; break;
    default: break;
  }
}

export async function createProfileMediaMigrationPlan(
  records: ProfileMediaMigrationRecord[],
  inspectObject: ProfileMediaMigrationInspection,
  manifestDigest: string,
  expectedBucketName?: string,
): Promise<ProfileMediaMigrationPlan> {
  if (!/^[a-f0-9]{64}$/i.test(manifestDigest)) throw new Error('A SHA-256 manifest digest is required.');
  const summary: ProfileMediaMigrationSummary = {
    profilesScanned: 0, actionsPlanned: 0, alreadyCanonical: 0, noMedia: 0,
    conflictingAliases: 0, malformedUrls: 0, unsupportedHosts: 0, unsupportedBuckets: 0, wrongOwnerPaths: 0,
    invalidReferences: 0, missingObjects: 0, invalidObjects: 0, unresolvedProfiles: 0,
  };
  const actions: ProfileMediaMigrationAction[] = [];

  for (const record of [...records].sort((a, b) =>
    a.collection.localeCompare(b.collection) || a.uid.localeCompare(b.uid))) {
    summary.profilesScanned++;
    if (!UID_PATTERN.test(record.uid)) {
      summary.invalidReferences++;
      summary.unresolvedProfiles++;
      continue;
    }

    const scalar: Array<{ field: typeof PROFILE_MEDIA_MIGRATION_FIELDS[number]; parsed: ParsedValue }> = [];
    const data = record.data ?? {};
    for (const field of PROFILE_MEDIA_MIGRATION_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
      const parsed = parseValue(record.uid, data[field], field === 'photoStoragePath' || field === 'photoPath', expectedBucketName);
      if (parsed.kind !== 'empty') scalar.push({ field, parsed });
    }

    const photoEntries: Array<{ index: number; parsed: ParsedValue }> = [];
    if (Object.prototype.hasOwnProperty.call(data, 'photos')) {
      if (!Array.isArray(data.photos)) {
        summary.invalidReferences++;
        summary.unresolvedProfiles++;
        continue;
      }
      for (let index = 0; index < data.photos.length; index++) {
        const parsed = parseValue(record.uid, data.photos[index], true, expectedBucketName);
        if (parsed.kind !== 'empty') photoEntries.push({ index, parsed });
      }
    }

    const allParsed = [...scalar.map(item => item.parsed), ...photoEntries.map(item => item.parsed)];
    const issues = allParsed.filter(item => !('objectPath' in item));
    if (issues.length > 0) {
      for (const issue of issues) countIssue(summary, issue);
      summary.unresolvedProfiles++;
      continue;
    }

    const scalarPaths = new Set(scalar.flatMap(item => 'objectPath' in item.parsed ? [item.parsed.objectPath] : []));
    if (scalarPaths.size > 1) {
      summary.conflictingAliases++;
      summary.unresolvedProfiles++;
      continue;
    }

    const objectPaths = [...new Set(allParsed.flatMap(item => 'objectPath' in item ? [item.objectPath] : []))];
    if (objectPaths.length === 0) {
      summary.noMedia++;
      continue;
    }

    const metadataByPath = new Map<string, ProfileMediaMigrationObject>();
    let objectFailure = false;
    for (const objectPath of objectPaths) {
      const metadata = await inspectObject(objectPath);
      metadataByPath.set(objectPath, metadata);
      if (!metadata.exists) {
        summary.missingObjects++;
        objectFailure = true;
      } else if (!metadata.generation || !metadata.metageneration
          || !metadata.contentType || !IMAGE_TYPES.has(metadata.contentType)
          || !Number.isFinite(metadata.size) || (metadata.size ?? 0) <= 0 || (metadata.size ?? 0) >= 8 * 1024 * 1024) {
        summary.invalidObjects++;
        objectFailure = true;
      }
    }
    if (objectFailure) {
      summary.unresolvedProfiles++;
      continue;
    }

    const updates: Record<string, unknown> = {};
    for (const item of scalar) {
      if (!('objectPath' in item.parsed)) continue;
      if (item.parsed.kind !== 'canonical') updates[item.field] = canonicalFor(record.uid, item.parsed.objectPath);
    }
    if (photoEntries.length > 0) {
      const sourcePhotos = data.photos as unknown[];
      const nextPhotos = [...sourcePhotos];
      for (const entry of photoEntries) {
        if ('objectPath' in entry.parsed && entry.parsed.kind !== 'canonical') {
          nextPhotos[entry.index] = canonicalFor(record.uid, entry.parsed.objectPath);
        }
      }
      if (JSON.stringify(nextPhotos) !== JSON.stringify(sourcePhotos)) updates.photos = nextPhotos;
    }

    const objectVersions = objectPaths.map(objectPath => {
      const metadata = metadataByPath.get(objectPath)!;
      return { objectPath, generation: metadata.generation!, metageneration: metadata.metageneration! };
    });
    if (Object.keys(updates).length === 0) {
      summary.alreadyCanonical++;
      continue;
    }

    actions.push({
      collection: record.collection,
      uid: record.uid,
      expectedAliasSnapshotHash: profileMediaAliasSnapshotHash(data),
      updates,
      objectVersions,
    });
    summary.actionsPlanned++;
  }

  const planDigest = hash(JSON.stringify({ version: 1, manifestDigest, summary, actions }));
  return { version: 1, manifestDigest, planDigest, summary, actions };
}

export async function applyProfileMediaMigrationBatch(
  plan: ProfileMediaMigrationPlan,
  dependencies: {
    compareAndSet: (action: ProfileMediaMigrationAction) => Promise<'updated' | 'already-applied' | 'conflict'>;
  },
  options: {
    checkpoint?: ProfileMediaMigrationCheckpoint;
    batchSize?: number;
    maxBatches?: number;
    onCheckpoint?: (checkpoint: ProfileMediaMigrationCheckpoint) => Promise<void> | void;
  } = {},
): Promise<ProfileMediaMigrationBatchResult> {
  const batchSize = options.batchSize ?? 25;
  const maxBatches = options.maxBatches ?? 1;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100
      || !Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 100) {
    throw new Error('Migration batch limits are outside the allowed bounds.');
  }
  const checkpoint: ProfileMediaMigrationCheckpoint = options.checkpoint ?? {
    version: 1, planDigest: plan.planDigest, nextIndex: 0, updated: 0, alreadyApplied: 0,
  };
  if (checkpoint.version !== 1 || checkpoint.planDigest !== plan.planDigest
      || !Number.isSafeInteger(checkpoint.nextIndex) || checkpoint.nextIndex < 0
      || checkpoint.nextIndex > plan.actions.length) {
    throw new Error('Migration checkpoint does not match the action plan.');
  }

  let processedThisRun = 0;
  let conflicts = 0;
  let stoppedOnConflict = false;
  let batches = 0;
  while (checkpoint.nextIndex < plan.actions.length && batches < maxBatches) {
    const batchEnd = Math.min(checkpoint.nextIndex + batchSize, plan.actions.length);
    while (checkpoint.nextIndex < batchEnd) {
      const action = plan.actions[checkpoint.nextIndex]!;
      const result = await dependencies.compareAndSet(action);
      if (result === 'conflict') {
        conflicts++;
        stoppedOnConflict = true;
        break;
      }
      if (result === 'updated') checkpoint.updated++;
      else checkpoint.alreadyApplied++;
      checkpoint.nextIndex++;
      processedThisRun++;
    }
    await options.onCheckpoint?.({ ...checkpoint });
    batches++;
    if (stoppedOnConflict) break;
  }
  return {
    checkpoint: { ...checkpoint },
    processedThisRun,
    conflicts,
    complete: checkpoint.nextIndex === plan.actions.length,
    stoppedOnConflict,
  };
}
