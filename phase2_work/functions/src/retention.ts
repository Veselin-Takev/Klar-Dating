// Minimal structural port keeps the app and Functions SDK installations independent.
type Metadata = { generation?: unknown; temporaryHold?: unknown; eventBasedHold?: unknown };
type Photo = { getMetadata(): Promise<[Metadata, ...unknown[]]>; delete(options: { ifGenerationMatch: string | number }): Promise<unknown> };
type Bucket = {
  getFiles(options: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string }): Promise<[Photo[], { pageToken?: string } | null | undefined, ...unknown[]]>;
};

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
        // Treat the provider response as untrusted at the destructive boundary.
        // A null/string/numeric/unknown hold is not evidence of an unheld file.
        if (!metadata
          || (metadata.temporaryHold !== undefined && metadata.temporaryHold !== false)
          || (metadata.eventBasedHold !== undefined && metadata.eventBasedHold !== false)) {
          throw new Error('storage_object_held_or_invalid');
        }
        const generation = metadata.generation;
        // GCS generations are positive opaque decimal identifiers; do not pass
        // undefined, non-decimal strings or rounded JS integers to delete().
        if ((typeof generation !== 'string' && typeof generation !== 'number')
          || !/^[1-9][0-9]*$/.test(String(generation))
          || (typeof generation === 'number' && !Number.isSafeInteger(generation))) {
          throw new Error('Photo generation missing or invalid');
        }
        await file.delete({ ifGenerationMatch: generation });
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

