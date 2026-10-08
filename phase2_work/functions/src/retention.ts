// Minimal structural port keeps the app and Functions SDK installations independent.
type Metadata = { timeCreated?: string; generation?: string | number; temporaryHold?: boolean | null; eventBasedHold?: boolean | null };
type Photo = { getMetadata(): Promise<[Metadata, ...unknown[]]>; delete(options: { ifGenerationMatch: string | number }): Promise<unknown> };
type Bucket = {
  getFiles(options: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string }): Promise<[Photo[], { pageToken?: string } | null | undefined, ...unknown[]]>;
  deleteFiles(options: { prefix: string }): Promise<unknown>;
};

export const PHOTO_RETENTION_MS = 30 * 86_400_000;

/** One bounded page. Generation preconditions protect a concurrently replaced photo. */
export async function deleteExpiredPhotoPage(bucket: Bucket, now: Date, pageToken?: string) {
  const [files, next] = await bucket.getFiles({ prefix: 'verification/', maxResults: 200, autoPaginate: false, ...(pageToken ? { pageToken } : {}) });
  let deleted = 0;
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const created = Date.parse(metadata.timeCreated ?? '');
    if (!Number.isFinite(created)) throw new Error('Photo creation timestamp missing');
    if (created > now.getTime() - PHOTO_RETENTION_MS || metadata.temporaryHold || metadata.eventBasedHold) continue;
    if (!metadata.generation) throw new Error('Photo generation missing');
    try {
      await file.delete({ ifGenerationMatch: metadata.generation });
      deleted++;
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 404 && code !== 412) throw error;
    }
  }
  return { deleted, scanned: files.length, nextPageToken: next?.pageToken };
}

/** Prefix includes the trailing slash so another account's files cannot match. */
export async function deleteAccountPhotos(bucket: Bucket, uid: string): Promise<void> {
  if (!uid || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid storage owner');
  for (const prefix of [`verification/${uid}/`, `profiles/${uid}/`]) {
    await bucket.deleteFiles({ prefix });
  }
}
