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

/** Read-only decision check before deletion and again before writing audit. */
export type PhotoRetentionDecision = {
  uid: string;
  challengeId: string;
  status: 'approved' | 'rejected' | 'pending';
  decidedAt: number;
  storagePath: string;
};

export function retentionTimestamp(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function matchesActiveRetentionDecision(
  data: Record<string, unknown> | undefined,
  artifact: PhotoRetentionDecision,
  now: number,
): boolean {
  if (!data || data.uid !== artifact.uid || data.storagePath !== artifact.storagePath ||
      data.photoPurged === true || data.legalHold === true || data.retentionHold === true) return false;
  const raw = data.entscheidung ?? data.status;
  const status = raw === 'bestaetigt' || raw === 'approved' ? 'approved' :
    raw === 'abgelehnt' || raw === 'rejected' ? 'rejected' : 'pending';
  if (status === 'pending' || status !== artifact.status) return false;
  const decidedAt = retentionTimestamp(data.decidedAt);
  const expiresAt = retentionTimestamp(data.fotoLoeschenAb);
  return decidedAt === artifact.decidedAt && expiresAt !== null && expiresAt <= now;
}
