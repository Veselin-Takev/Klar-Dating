// Minimal structural port keeps the app and Functions SDK installations independent.
type Metadata = {
  timeCreated?: string;
  generation?: string | number;
  temporaryHold?: boolean | null;
  eventBasedHold?: boolean | null;
};
type Photo = {
  name?: string;
  getMetadata(): Promise<[Metadata, ...unknown[]]>;
  delete(options: { ifGenerationMatch: string | number }): Promise<unknown>;
};
type Bucket = {
  getFiles(options: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string }): Promise<[Photo[], { pageToken?: string } | null | undefined, ...unknown[]]>;
};

export const PHOTO_RETENTION_MS = 30 * 86_400_000;
const UINT64_MAX = (1n << 64n) - 1n;

/**
 * VES-5 P0: age-only verification deletion is unsafe, because object creation
 * age does not prove a final moderation decision, no hold or an all-writer fence.
 * Retired entrypoint deliberately rejects before any Storage call, including
 * in tests. Funnel TTL cleanup is independently handled by its scheduler.
 */
export async function deleteExpiredPhotoPage(_bucket: Bucket, _now: Date, _pageToken?: string): Promise<never> {
  throw new Error('verification_photo_p0_fencing_unverified');
}

function assertSafeGeneration(metadata: Metadata): string | number {
  const generation = metadata.generation;
  if (typeof generation === 'number') {
    if (Number.isSafeInteger(generation) && generation > 0) return generation;
  } else if (typeof generation === 'string' && /^[1-9]\d*$/.test(generation)) {
    if (BigInt(generation) <= UINT64_MAX) return generation;
  }
  throw new Error('storage_object_metadata_invalid');
}

function assertNotHeld(metadata: Metadata): void {
  // Missing flags are normal for some Storage versions; any *present* flag
  // except literal false is ambiguous or held and therefore blocks deletion.
  for (const key of ['temporaryHold', 'eventBasedHold'] as const) {
    if (Object.prototype.hasOwnProperty.call(metadata, key) && metadata[key] !== false) {
      throw new Error('storage_object_held');
    }
  }
}

/**
 * VES-15 P0 containment for Art.17 account deletion.
 *
 * Never delete verification/{uid} without real cross-service Firestore/GCS
 * all-writer fencing. Existing verification photos force explicit pending
 * status rather than a silently successful account erasure. Only ordinary
 * profiles/{uid} photos may be removed under a GCS generation precondition.
 *
 * This is *temporary* containment, not a proof of global linearizability:
 * external writers may create a photo after the second inventory. Full
 * production approval requires independently verified all-writer fencing.
 */
export async function deleteAccountPhotos(bucket: Bucket, uid: string, authorizeVerification?: (path: string, metadata: Metadata) => Promise<void>): Promise<boolean> {
  if (!uid || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid storage owner');

  const verificationPrefix = `verification/${uid}/`;
  const assertNoVerificationPhotos = async (): Promise<void> => {
    const [files, next] = await bucket.getFiles({ prefix: verificationPrefix, maxResults: 1, autoPaginate: false });
    if (!Array.isArray(files) || (!authorizeVerification && (files.length > 0 || next?.pageToken))) {
      throw new Error('verification_photo_p0_fencing_unverified');
    }
  };

  // First check must precede even a normal profile photo deletion.
  await assertNoVerificationPhotos();

  if (authorizeVerification) {
    const [evidence, nextEvidence] = await bucket.getFiles({ prefix: verificationPrefix, maxResults: 100, autoPaginate: false });
    if (!Array.isArray(evidence) || evidence.length > 100) throw new Error('storage_page_limit_exceeded');
    for (const file of evidence) {
      if (!file.name || !file.name.startsWith(verificationPrefix)) throw new Error('verification_provenance_unverified');
      const [metadata] = await file.getMetadata();
      assertNotHeld(metadata);
      const generation = assertSafeGeneration(metadata);
      await authorizeVerification(file.name, metadata);
      // GCS enforces holds as well as object generation at the delete boundary.
      await file.delete({ ifGenerationMatch: generation });
    }
    if (evidence.length || nextEvidence?.pageToken) return false;
  }

  const [files, next] = await bucket.getFiles({ prefix: `profiles/${uid}/`, maxResults: 100, autoPaginate: false });
  if (!Array.isArray(files) || files.length > 100) throw new Error('storage_page_limit_exceeded');
  let deleted = 0;

  for (const file of files) {
    try {
      const [metadata] = await file.getMetadata();
      if (!metadata || typeof metadata !== 'object') throw new Error('storage_object_metadata_invalid');
      assertNotHeld(metadata);
      const generation = assertSafeGeneration(metadata);
      await file.delete({ ifGenerationMatch: generation });
      deleted++;
    } catch (error) {
      // Only a genuinely already-missing object can be ignored; do not treat
      // an aborted update, hold, conflict (412) or service failure as progress.
      if ((error as { code?: number }).code !== 404) throw error;
    }
  }

  // Detect verification objects that appeared during profile-photo cleanup.
  if (authorizeVerification) {
    const [remaining, nextRemaining] = await bucket.getFiles({prefix: verificationPrefix, maxResults: 1, autoPaginate: false});
    if (remaining.length || nextRemaining?.pageToken) return false;
  } else await assertNoVerificationPhotos();

  if (!files.length && !next?.pageToken) return true;
  if (!deleted) throw new Error('storage_erasure_no_progress');
  return false;
}
