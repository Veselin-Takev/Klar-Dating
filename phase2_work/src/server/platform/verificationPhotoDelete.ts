/**
 * GCS deletion boundary for sensitive verification photos.
 * Never issue an unconditional DELETE: the generation must still match the
 * object whose metadata/holds were inspected.
 */
export type VerificationPhotoMetadata = {
  generation?: string | number | null;
  temporaryHold?: boolean | null;
  eventBasedHold?: boolean | null;
  retentionExpirationTime?: string | null;
  retention?: { retainUntilTime?: string | null } | null;
};

export type VerificationPhotoBucket = {
  file: (path: string) => {
    getMetadata: () => Promise<[VerificationPhotoMetadata, ...unknown[]]>;
    delete: (options: { ifGenerationMatch: string }) => Promise<unknown>;
  };
};

export async function deleteVerificationPhotoIfUnchanged(
  bucket: VerificationPhotoBucket,
  path: string,
  now: number = Date.now(),
): Promise<void> {
  if (!/^verification\/[^/]+\/[^/]+$/.test(path) || path.split('/').includes('..')) {
    throw new Error('verification_photo_invalid_path');
  }
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata(); // 404 is NOT an acknowledged deletion
  if (!metadata || metadata.temporaryHold || metadata.eventBasedHold) {
    throw new Error('verification_photo_held_or_unavailable');
  }
  for (const until of [metadata.retentionExpirationTime, metadata.retention?.retainUntilTime]) {
    if (until != null) {
      const expiry = Date.parse(until);
      if (!Number.isFinite(expiry) || expiry > now) throw new Error('verification_photo_under_retention');
    }
  }
  // GCS generations are decimal integers; do not round through a JS number.
  const generation = String(metadata.generation ?? '');
  if (!/^[1-9][0-9]*$/.test(generation)) throw new Error('verification_photo_generation_missing');
  // GCS returns 412 if the live object was replaced between metadata and DELETE.
  await file.delete({ ifGenerationMatch: generation });
}
