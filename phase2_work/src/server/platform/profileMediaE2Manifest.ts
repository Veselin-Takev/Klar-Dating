import { createHash } from 'node:crypto';

export type ProfileMediaE2CohortItem = {
  collection?: 'users' | 'public_profiles';
  uid?: string;
  objectPath?: string;
  generation?: string;
  metageneration?: string;
};
export type ProfileMediaE2Manifest = {
  version: 1;
  environment: 'staging';
  approved: true;
  approvalId: string;
  approvedAt: string;
  expiresAt: string;
  projectId: string;
  bucketName: string;
  profileCohort?: Array<{ collection: 'users' | 'public_profiles'; uid: string }>;
  objectCohort?: Array<{ objectPath: string; generation: string; metageneration: string }>;
};
export type ProfileMediaE2Identity = {
  projectId: string;
  bucketName: string;
  emulator?: boolean;
  execute?: boolean;
  confirmStagingExecution?: boolean;
  manifestDigest?: string;
  env?: NodeJS.ProcessEnv;
};

export function profileMediaManifestDigest(rawManifest: string): string {
  return createHash('sha256').update(rawManifest).digest('hex');
}

function rejectProductionLike(value: string): boolean {
  return /(prod|production|live|primary)/i.test(value);
}

export function validateProfileMediaE2Manifest(
  manifest: ProfileMediaE2Manifest,
  identity: ProfileMediaE2Identity,
): void {
  const env = identity.env ?? process.env;
  if (!manifest || manifest.version !== 1 || manifest.environment !== 'staging' || manifest.approved !== true
      || typeof manifest.approvalId !== 'string' || !manifest.approvalId.trim()
      || !Number.isFinite(Date.parse(manifest.approvedAt))
      || !Number.isFinite(Date.parse(manifest.expiresAt))
      || Date.parse(manifest.expiresAt) <= Date.now()
      || Date.parse(manifest.approvedAt) > Date.now()
      || manifest.projectId !== identity.projectId || manifest.bucketName !== identity.bucketName) {
    throw new Error('E2 approval manifest is invalid, expired, or does not match the selected target.');
  }
  if (!identity.projectId || !identity.bucketName || rejectProductionLike(identity.projectId) || rejectProductionLike(identity.bucketName)) {
    throw new Error('Production-like or missing project/bucket identities are refused.');
  }
  if (identity.emulator) {
    if (!identity.projectId.startsWith('demo-')
        || identity.bucketName !== identity.projectId + '.appspot.com'
        || !env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_STORAGE_EMULATOR_HOST || !env.STORAGE_EMULATOR_HOST) {
      throw new Error('Emulator mode requires matching demo project, bucket and Firestore/Storage emulator hosts.');
    }
  } else if (env.KLAR_E2_STAGING_PROJECT_ID !== identity.projectId
      || env.KLAR_E2_STAGING_BUCKET !== identity.bucketName
      || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_STORAGE_EMULATOR_HOST || env.STORAGE_EMULATOR_HOST) {
    throw new Error('The staging project/bucket is not in the process allowlist or emulator variables are present.');
  }
  if (identity.execute) {
    if (!identity.confirmStagingExecution || !identity.manifestDigest
        || env.KLAR_E2_APPROVED_MANIFEST_SHA256 !== identity.manifestDigest) {
      throw new Error('Execution requires explicit staging confirmation and an independently pinned approved manifest digest.');
    }
  }
  if (manifest.profileCohort !== undefined) {
    if (!Array.isArray(manifest.profileCohort) || manifest.profileCohort.length === 0
        || manifest.profileCohort.length > 5000) throw new Error('Profile cohort is empty or outside the bounded limit.');
    const seen = new Set<string>();
    for (const item of manifest.profileCohort) {
      if (!item || !['users', 'public_profiles'].includes(item.collection)
          || !/^[A-Za-z0-9_-]{1,128}$/.test(item.uid)) throw new Error('Profile cohort contains an invalid entry.');
      const key = item.collection + ':' + item.uid;
      if (seen.has(key)) throw new Error('Profile cohort contains duplicate entries.');
      seen.add(key);
    }
  }
  if (manifest.objectCohort !== undefined) {
    if (!Array.isArray(manifest.objectCohort) || manifest.objectCohort.length === 0
        || manifest.objectCohort.length > 5000) throw new Error('Object cohort is empty or outside the bounded limit.');
    const seen = new Set<string>();
    for (const item of manifest.objectCohort) {
      if (!item || typeof item.objectPath !== 'string'
          || !/^profiles\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_./-]+$/.test(item.objectPath)
          || item.objectPath.includes('\\')
          || item.objectPath.split('/').some(part => !part || part === '.' || part === '..')
          || !/^\d+$/.test(item.generation) || !/^\d+$/.test(item.metageneration)) {
        throw new Error('Object cohort contains an invalid or unversioned entry.');
      }
      if (seen.has(item.objectPath)) throw new Error('Object cohort contains duplicate objects.');
      seen.add(item.objectPath);
    }
  }
}
