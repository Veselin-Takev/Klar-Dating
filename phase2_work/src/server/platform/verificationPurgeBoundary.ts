import {
  DEFAULT_VERIFICATION_RETENTION_DAYS,
  MS_PER_DAY,
  generatePurgeAuditDigest,
  type VerificationArtifactRecord,
} from './storageRetentionEngine';

/** Fail closed on incomplete/ambiguous verification data before any GCS mutation. */
function epochMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && 'toMillis' in value &&
      typeof value.toMillis === 'function') {
    const timestamp = value.toMillis();
    return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
  }
  return null;
}

function decision(value: unknown): VerificationArtifactRecord['status'] | null {
  if (value === 'bestaetigt' || value === 'approved') return 'approved';
  if (value === 'abgelehnt' || value === 'rejected') return 'rejected';
  if (value === 'pending' || value === 'ausstehend') return 'pending';
  return null;
}

/**
 * Only explicitly present, strictly boolean hold flags can be interpreted.
 * Nonboolean legacy/malformed flags (e.g. "false", null, 0, objects) must
 * prevent destructive operations; do not coerce truthy/falsy values.
 *
 * A missing flag is NOT a positive legal-clearance attestation: a full
 * decision/hold-authority contract remains a separate P0 release blocker.
 */
export function hasUnambiguousVerificationHoldFlags(
  record: Record<string, unknown> | undefined,
): boolean {
  return !!record && (['legalHold', 'retentionHold', 'hold'] as const)
    .every(flag => !Object.hasOwn(record, flag) || typeof record[flag] === 'boolean');
}

export function assertCurrentVerificationPurgeCandidate(
  current: Record<string, unknown> | undefined,
  artifact: VerificationArtifactRecord,
  now: number,
): void {
  if (!current || !hasUnambiguousVerificationHoldFlags(current) ||
      // An explicitly malformed purge marker must never be treated as false.
      (Object.hasOwn(current, 'photoPurged') && typeof current.photoPurged !== 'boolean') ||
      Object.hasOwn(current, 'photoPurgedAt') || Object.hasOwn(current, 'auditDigest') ||
      !Number.isFinite(now) || now <= 0 ||
      !artifact.uid || !artifact.challengeId || !artifact.storagePath.startsWith(`verification/${artifact.uid}/`)) {
    throw new Error('verification_purge_candidate_unavailable');
  }
  const primary = decision(current.entscheidung);
  const secondary = decision(current.status);
  if (current.entscheidung !== undefined && !primary ||
      current.status !== undefined && !secondary ||
      primary !== null && secondary !== null && primary !== secondary) {
    throw new Error('verification_purge_conflicting_decision');
  }
  const status = primary ?? secondary;
  const date = epochMillis(current.decidedAt);
  const due = epochMillis(current.fotoLoeschenAb);
  if (current.uid !== artifact.uid ||
      current.storagePath !== artifact.storagePath ||
      current.photoPurged === true ||
      current.legalHold === true || current.retentionHold === true || current.hold === true ||
      status === null || status === 'pending' || status !== artifact.status ||
      date === null || date !== artifact.decidedAt || due === null ||
      date <= 0 || date > now || now < date + DEFAULT_VERIFICATION_RETENTION_DAYS * MS_PER_DAY ||
      due > now || due < date + DEFAULT_VERIFICATION_RETENTION_DAYS * MS_PER_DAY) {
    throw new Error('verification_purge_candidate_changed');
  }
}


/**
 * A completed purge must have an internally consistent, authoritative receipt.
 * This SHA-256 digest is a consistency check, NOT proof of physical deletion
 * or a tamper-resistant signature. Production reconciliation remains P0.
 */
export function assertCompletedVerificationPurgeReceipt(
  current: Record<string, unknown> | undefined,
  artifact: VerificationArtifactRecord,
  now: number,
): void {
  if (!current || current.photoPurged !== true || !artifact.photoPurged ||
      !hasUnambiguousVerificationHoldFlags(current) ||
      !Number.isSafeInteger(now) || now <= 0 ||
      current.uid !== artifact.uid || current.storagePath !== artifact.storagePath) {
    throw new Error('verification_purge_receipt_invalid');
  }
  const primary = decision(current.entscheidung);
  const secondary = decision(current.status);
  const decidedAt = epochMillis(current.decidedAt);
  const purgedAt = epochMillis(current.photoPurgedAt);
  if (primary !== null && secondary !== null && primary !== secondary ||
      (current.entscheidung !== undefined && primary === null) ||
      (current.status !== undefined && secondary === null) ||
      (primary ?? secondary) !== artifact.status ||
      decidedAt === null || decidedAt !== artifact.decidedAt ||
      purgedAt === null || !Number.isSafeInteger(purgedAt) ||
      purgedAt > now || purgedAt < decidedAt + DEFAULT_VERIFICATION_RETENTION_DAYS * MS_PER_DAY ||
      typeof current.auditDigest !== 'string' || !/^[a-f0-9]{64}$/.test(current.auditDigest) ||
      current.auditDigest !== generatePurgeAuditDigest(artifact.uid, artifact.challengeId, artifact.storagePath, purgedAt)) {
    throw new Error('verification_purge_receipt_invalid');
  }
}

/**
 * Production GCS generation precondition must be a canonical positive uint64
 * decimal value, never an unbounded number or an imprecise JS conversion.
 * This is an independent live-path fence: the inert queue is not imported.
 */
export function isCanonicalDeletionGeneration(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value)) return false;
  return value.length < 20 || value <= '18446744073709551615';
}

/** GCS object-version fence: never delete a different generation or held object. */
export function verifiedDeletionGeneration(metadata: Record<string, unknown> | undefined, now: number): string {
  const generation = metadata?.generation;
  const value = typeof generation === 'string' ? generation :
    typeof generation === 'number' && Number.isSafeInteger(generation) ? String(generation) : '';
  // GCS Object Retention is independent of legacy retentionExpirationTime.
  // Refuse ambiguous present hold metadata rather than coercing its value.
  for (const flag of ['temporaryHold', 'eventBasedHold', 'hold'] as const) {
    if (metadata && Object.hasOwn(metadata, flag) && typeof metadata[flag] !== 'boolean') {
      throw new Error('verification_photo_generation_or_hold_invalid');
    }
  }
  if (!isCanonicalDeletionGeneration(value) ||
      metadata?.temporaryHold === true || metadata?.eventBasedHold === true ||
      metadata?.hold === true) {
    throw new Error('verification_photo_generation_or_hold_invalid');
  }
  if (metadata && Object.hasOwn(metadata, 'retentionExpirationTime')) {
    const end = epochMillis(metadata.retentionExpirationTime);
    if (end === null || end > now) throw new Error('verification_photo_retention_hold_active');
  }
  // GCS per-object retention (retention.retainUntilTime) is distinct
  // from retentionExpirationTime; malformed or active retention denies purge.
  if (metadata && Object.hasOwn(metadata, 'retention')) {
    const retention = metadata.retention;
    if (retention === null || typeof retention !== 'object' || Array.isArray(retention)) {
      throw new Error('verification_photo_retention_hold_active');
    }
    const until = (retention as Record<string, unknown>).retainUntilTime;
    const end = epochMillis(until);
    if (end === null || end > now) throw new Error('verification_photo_retention_hold_active');
  }
  return value;
}
