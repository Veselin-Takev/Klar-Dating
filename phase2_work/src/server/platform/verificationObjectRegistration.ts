import type { Firestore } from 'firebase-admin/firestore';
import {
  ensureVerificationDeletionFenceForUploadedObject,
  type VerificationDeletionFence,
} from './verificationDeletionFence';

export const TRUSTED_VERIFICATION_WRITER_MARKER = 'klar-verification-backend-v1';

export interface FinalizedVerificationObject {
  bucket: unknown;
  name: unknown;
  generation: unknown;
  metageneration: unknown;
  metadata: unknown;
}

/**
 * Register a finalized verification object using only the immutable identity
 * from the Storage finalize event and backend-owned custom metadata.
 *
 * Firebase Storage Rules deny all client writes to verification/. The marker
 * is therefore accepted only at this Admin-SDK writer boundary. This helper
 * never changes or deletes the Storage object.
 */
export async function registerFinalizedVerificationObject(
  db: Firestore,
  configuredBucket: string,
  object: FinalizedVerificationObject,
): Promise<VerificationDeletionFence | null> {
  if (typeof object.name !== 'string' || !object.name.startsWith('verification/')) {
    return null;
  }

  if (typeof configuredBucket !== 'string' || !configuredBucket
    || object.bucket !== configuredBucket) {
    throw new Error('verification_deletion_finalize_bucket_mismatch');
  }

  const segments = object.name.split('/');
  if (segments.length < 3 || segments.some(segment => !segment || segment === '.' || segment === '..')
    || segments[0] !== 'verification') {
    throw new Error('verification_deletion_finalize_path_invalid');
  }

  const uid = segments[1];
  if (typeof uid !== 'string' || !uid) {
    throw new Error('verification_deletion_finalize_uid_invalid');
  }

  const metadata = object.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error('verification_deletion_finalize_metadata_missing');
  }
  const custom = metadata as Record<string, unknown>;
  if (custom.klarWriter !== TRUSTED_VERIFICATION_WRITER_MARKER
    || custom.uid !== uid
    || typeof custom.challengeId !== 'string' || !custom.challengeId.trim()
    || typeof custom.createdBy !== 'string' || !custom.createdBy.trim()) {
    throw new Error('verification_deletion_finalize_identity_invalid');
  }

  if ((typeof object.generation !== 'string' && typeof object.generation !== 'number')
    || (typeof object.metageneration !== 'string' && typeof object.metageneration !== 'number')) {
    throw new Error('verification_deletion_finalize_version_missing');
  }

  return ensureVerificationDeletionFenceForUploadedObject(db, {
    uid,
    challengeId: custom.challengeId,
    bucket: configuredBucket,
    storagePath: object.name,
    observedGeneration: object.generation,
    observedMetageneration: object.metageneration,
    createdBy: custom.createdBy,
  });
}
