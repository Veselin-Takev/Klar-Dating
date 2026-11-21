import { createHash } from 'node:crypto';

export type ProfileMediaTokenMetadata = {
  exists: boolean;
  generation?: string;
  metageneration?: string;
  customMetadata?: Record<string, string | undefined>;
};
export type ProfileMediaTokenCohortItem = {
  objectPath: string;
  generation: string;
  metageneration: string;
};
export type ProfileMediaTokenRevocationAction = {
  objectPath: string;
  generation: string;
  metageneration: string;
};
export type ProfileMediaTokenRevocationPlan = {
  version: 1;
  manifestDigest: string;
  planDigest: string;
  summary: {
    selected: number;
    eligible: number;
    tokenMetadataPresent: number;
    alreadyAbsent: number;
    missingObjects: number;
    manifestMismatches: number;
  };
  actions: ProfileMediaTokenRevocationAction[];
};
export type ProfileMediaTokenRevocationResult = {
  revoked: number;
  alreadyAbsent: number;
  missing: number;
  conflicts: number;
  stopped: boolean;
};

const TOKEN_KEY = 'firebaseStorageDownloadTokens';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function hasToken(metadata: ProfileMediaTokenMetadata): boolean {
  const value = metadata.customMetadata?.[TOKEN_KEY];
  return typeof value === 'string' && value.trim().length > 0;
}
function sameMetadata(a: Record<string, string | undefined>, b: Record<string, string | undefined>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter(key => key !== TOKEN_KEY));
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}
function validObjectPath(path: string): boolean {
  return /^profiles\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_./-]+$/.test(path)
    && !path.includes('\\')
    && path.split('/').every(part => part && part !== '.' && part !== '..');
}

export async function createProfileMediaTokenRevocationPlan(
  cohort: ProfileMediaTokenCohortItem[],
  inspectObject: (objectPath: string) => Promise<ProfileMediaTokenMetadata>,
  manifestDigest: string,
): Promise<ProfileMediaTokenRevocationPlan> {
  if (!/^[a-f0-9]{64}$/i.test(manifestDigest) || !Array.isArray(cohort) || cohort.length === 0 || cohort.length > 5000) {
    throw new Error('A bounded approved cohort and SHA-256 manifest digest are required.');
  }
  const summary = { selected: cohort.length, eligible: 0, tokenMetadataPresent: 0, alreadyAbsent: 0, missingObjects: 0, manifestMismatches: 0 };
  const actions: ProfileMediaTokenRevocationAction[] = [];
  const seen = new Set<string>();
  for (const item of [...cohort].sort((a, b) => a.objectPath.localeCompare(b.objectPath))) {
    if (!item || !validObjectPath(item.objectPath) || !/^\d+$/.test(item.generation) || !/^\d+$/.test(item.metageneration)
        || seen.has(item.objectPath)) {
      summary.manifestMismatches++;
      continue;
    }
    seen.add(item.objectPath);
    const current = await inspectObject(item.objectPath);
    if (!current.exists) {
      summary.missingObjects++;
      continue;
    }
    if (current.generation !== item.generation || current.metageneration !== item.metageneration) {
      summary.manifestMismatches++;
      continue;
    }
    if (!hasToken(current)) {
      summary.alreadyAbsent++;
      continue;
    }
    summary.tokenMetadataPresent++;
    summary.eligible++;
    actions.push({ objectPath: item.objectPath, generation: item.generation, metageneration: item.metageneration });
  }
  const planDigest = hash(JSON.stringify({ version: 1, manifestDigest, summary, actions }));
  return { version: 1, manifestDigest, planDigest, summary, actions };
}

export async function executeProfileMediaTokenRevocation(
  plan: ProfileMediaTokenRevocationPlan,
  dependencies: {
    readMetadata: (objectPath: string) => Promise<ProfileMediaTokenMetadata>;
    patchCustomMetadata: (
      objectPath: string,
      patch: { firebaseStorageDownloadTokens: null },
      options: { ifMetagenerationMatch: string },
    ) => Promise<void>;
  },
): Promise<ProfileMediaTokenRevocationResult> {
  if (plan.version !== 1 || plan.summary.manifestMismatches > 0 || plan.summary.missingObjects > 0) {
    throw new Error('Revocation plan contains manifest mismatches or missing objects; execution is refused.');
  }
  const result: ProfileMediaTokenRevocationResult = { revoked: 0, alreadyAbsent: 0, missing: 0, conflicts: 0, stopped: false };
  for (const action of plan.actions) {
    const before = await dependencies.readMetadata(action.objectPath);
    if (!before.exists) {
      result.missing++;
      result.stopped = true;
      break;
    }
    if (before.generation !== action.generation || before.metageneration !== action.metageneration) {
      result.conflicts++;
      result.stopped = true;
      break;
    }
    if (!hasToken(before)) {
      result.alreadyAbsent++;
      continue;
    }
    try {
      await dependencies.patchCustomMetadata(
        action.objectPath,
        { firebaseStorageDownloadTokens: null },
        { ifMetagenerationMatch: before.metageneration! },
      );
    } catch (error) {
      const code = (error as { code?: number | string; statusCode?: number }).code
        ?? (error as { statusCode?: number }).statusCode;
      if (code === 412 || code === '412' || code === 'conditionNotMet') {
        result.conflicts++;
        result.stopped = true;
        break;
      }
      throw new Error('Token metadata patch failed; the cohort was stopped without retry.');
    }
    const after = await dependencies.readMetadata(action.objectPath);
    if (!after.exists || after.generation !== before.generation || hasToken(after)
        || !sameMetadata(before.customMetadata ?? {}, after.customMetadata ?? {})) {
      throw new Error('Post-revocation verification failed; stop and reconcile the object manually.');
    }
    result.revoked++;
  }
  return result;
}
