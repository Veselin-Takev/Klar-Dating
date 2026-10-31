// Minimal structural port keeps the app and Functions SDK installations independent.
type Metadata = { timeCreated?: string; generation?: string | number; temporaryHold?: boolean | null; eventBasedHold?: boolean | null };
type Photo = { getMetadata(): Promise<[Metadata, ...unknown[]]>; delete(options: { ifGenerationMatch: string | number }): Promise<unknown> };
type Bucket = {
  getFiles(options: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string }): Promise<[Photo[], { pageToken?: string } | null | undefined, ...unknown[]]>;
};

/** @deprecated Historical threshold, not authorization to delete verification photos. */
export const PHOTO_RETENTION_MS = 30 * 86_400_000;

/**
 * @deprecated Deliberately fail closed for all callers, including legacy tests
 * and accidental re-imports. Photo purging must be driven by the server-side
 * verification_events decision, fotoLoeschenAb, and audited retention engine.
 * Do not restore object-age deletion or silently return a successful page.
 */
export async function deleteExpiredPhotoPage(_bucket: Bucket, _now: Date, _pageToken?: string): Promise<never> {
  throw new Error('legacy_photo_age_retention_disabled');
}

/** One bounded page per prefix; false means acknowledged progress, not completion.
 * Re-list from the beginning because deleted objects disappear. Never skip a hold
 * or generation conflict and then declare the account's storage empty.
 */
export async function deleteAccountPhotos(bucket: Bucket, uid: string): Promise<boolean> {
  if (!uid || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid storage owner');
  let deleted = 0;
  let listed = 0;
  let more = false;
  for (const prefix of [`verification/${uid}/`, `profiles/${uid}/`]) {
    const [files, next] = await bucket.getFiles({ prefix, maxResults: 100, autoPaginate: false });
    if (files.length > 100) throw new Error('storage_page_limit_exceeded');
    listed += files.length;
    more ||= Boolean(next?.pageToken);
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        if (metadata.temporaryHold || metadata.eventBasedHold) throw new Error('storage_object_held');
        if (!metadata.generation) throw new Error('Photo generation missing');
        await file.delete({ ifGenerationMatch: metadata.generation });
        deleted++;
      } catch (error) {
        // Concurrent deletion is harmless, but is not evidence of our progress.
        // Conflicts (412), holds and service failures retain the failure budget.
        if ((error as { code?: number }).code !== 404) throw error;
      }
    }
  }
  if (!listed && !more) return true;
  if (!deleted) throw new Error('storage_erasure_no_progress');
  return false;
}

