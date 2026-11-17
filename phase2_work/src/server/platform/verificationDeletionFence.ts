import { createHash, randomUUID } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const VERIFICATION_DELETION_FENCE_COLLECTION = 'verificationDeletionFences';
export const VERIFICATION_DELETION_FENCE_SCHEMA_VERSION = 1 as const;
export const DEFAULT_DELETION_RESERVATION_TTL_MS = 5 * 60_000;

export type VerificationDeletionState =
  | 'eligible'
  | 'held'
  | 'delete_reserved'
  | 'deleted';

export type VerificationDeletionHoldField =
  | 'legalHoldActive'
  | 'moderationHoldActive'
  | 'accountErasureActive';

export interface VerificationDeletionFence {
  schemaVersion: typeof VERIFICATION_DELETION_FENCE_SCHEMA_VERSION;
  uid: string;
  challengeId: string;
  bucket: string;
  storagePath: string;
  objectKey: string;
  observedGeneration: string;
  observedMetageneration: string | null;
  decisionVersion: number;
  holdVersion: number;
  state: VerificationDeletionState;
  legalHoldActive: boolean;
  moderationHoldActive: boolean;
  accountErasureActive: boolean;
  reservationToken: string | null;
  reservationOwner: string | null;
  reservedAt: Timestamp | null;
  reservationExpiresAt: Timestamp | null;
  decisionReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastTransitionAt: Timestamp;
  lastTransitionBy: string;
  attemptCount: number;
  lastErrorCode: string | null;
  deletedAt: Timestamp | null;
  deletedGeneration: string | null;
}

export interface CreateVerificationDeletionFenceInput {
  uid: string;
  challengeId: string;
  bucket: string;
  storagePath: string;
  observedGeneration: string | number;
  observedMetageneration?: string | number | null;
  legalHoldActive?: boolean;
  moderationHoldActive?: boolean;
  accountErasureActive?: boolean;
  createdBy: string;
}

export type VerificationDeletionReservation =
  | { status: 'reserved'; objectKey: string; reservationToken: string; fence: VerificationDeletionFence }
  | { status: 'held'; objectKey: string; fence: VerificationDeletionFence };

export class VerificationDeletionFenceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'VerificationDeletionFenceError';
  }
}

function fail(code: string): never {
  throw new VerificationDeletionFenceError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp
    || (isRecord(value) && typeof value.toMillis === 'function');
}

function normalizeGeneration(value: unknown, code: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') fail(code);
  if (typeof value === 'number' && !Number.isSafeInteger(value)) fail(code);
  const normalized = String(value);
  if (!/^[1-9][0-9]*$/.test(normalized)) fail(code);
  return normalized;
}

function requireIdentifier(value: unknown, code: string, maxLength = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || value.includes('/')) {
    fail(code);
  }
  return value;
}

export function verificationDeletionObjectKey(input: {
  uid: string;
  bucket: string;
  storagePath: string;
  observedGeneration: string | number;
}): string {
  const uid = requireIdentifier(input.uid, 'verification_deletion_uid_invalid');
  const bucket = requireIdentifier(input.bucket, 'verification_deletion_bucket_invalid');
  const storagePath = requireIdentifier(input.storagePath, 'verification_deletion_path_invalid', 1024);
  const generation = normalizeGeneration(
    input.observedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  if (!storagePath.startsWith(`verification/${uid}/`)
    || storagePath.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('verification_deletion_path_invalid');
  }

  return createHash('sha256')
    .update([uid, bucket, storagePath, generation].join('\u0000'))
    .digest('hex');
}

function readHoldFlag(value: unknown, field: VerificationDeletionHoldField): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') fail('verification_deletion_hold_flag_invalid');
  return value;
}

function hasActiveHold(fence: Pick<VerificationDeletionFence,
  'legalHoldActive' | 'moderationHoldActive' | 'accountErasureActive'>): boolean {
  return fence.legalHoldActive || fence.moderationHoldActive || fence.accountErasureActive;
}

/** Build and validate a schema-v1 record without performing Firestore I/O. */
export function buildVerificationDeletionFence(
  input: CreateVerificationDeletionFenceInput,
  now = Timestamp.now(),
): VerificationDeletionFence {
  const uid = requireIdentifier(input.uid, 'verification_deletion_uid_invalid');
  const challengeId = requireIdentifier(input.challengeId, 'verification_deletion_challenge_invalid');
  const bucket = requireIdentifier(input.bucket, 'verification_deletion_bucket_invalid');
  const storagePath = requireIdentifier(input.storagePath, 'verification_deletion_path_invalid', 1024);
  const observedGeneration = normalizeGeneration(
    input.observedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  const observedMetageneration = input.observedMetageneration == null
    ? null
    : normalizeGeneration(input.observedMetageneration, 'verification_deletion_metageneration_invalid');
  const createdBy = requireIdentifier(input.createdBy, 'verification_deletion_actor_invalid', 128);
  const objectKey = verificationDeletionObjectKey({ uid, bucket, storagePath, observedGeneration });

  const legalHoldActive = readHoldFlag(input.legalHoldActive, 'legalHoldActive');
  const moderationHoldActive = readHoldFlag(input.moderationHoldActive, 'moderationHoldActive');
  const accountErasureActive = readHoldFlag(input.accountErasureActive, 'accountErasureActive');
  const held = legalHoldActive || moderationHoldActive || accountErasureActive;

  return {
    schemaVersion: VERIFICATION_DELETION_FENCE_SCHEMA_VERSION,
    uid,
    challengeId,
    bucket,
    storagePath,
    objectKey,
    observedGeneration,
    observedMetageneration,
    decisionVersion: 0,
    holdVersion: held ? 1 : 0,
    state: held ? 'held' : 'eligible',
    legalHoldActive,
    moderationHoldActive,
    accountErasureActive,
    reservationToken: null,
    reservationOwner: null,
    reservedAt: null,
    reservationExpiresAt: null,
    decisionReason: held ? 'hold_present_at_fence_creation' : null,
    createdAt: now,
    updatedAt: now,
    lastTransitionAt: now,
    lastTransitionBy: createdBy,
    attemptCount: 0,
    lastErrorCode: null,
    deletedAt: null,
    deletedGeneration: null,
  };
}

function parseFence(value: unknown, expectedObjectKey: string): VerificationDeletionFence {
  if (!isRecord(value)
    || value.schemaVersion !== VERIFICATION_DELETION_FENCE_SCHEMA_VERSION
    || value.objectKey !== expectedObjectKey
    || typeof value.uid !== 'string' || !value.uid
    || typeof value.challengeId !== 'string' || !value.challengeId
    || typeof value.bucket !== 'string' || !value.bucket
    || typeof value.storagePath !== 'string'
    || !value.storagePath.startsWith(`verification/${value.uid}/`)
    || typeof value.observedGeneration !== 'string'
    || !/^[1-9][0-9]*$/.test(value.observedGeneration)
    || !(value.observedMetageneration === null
      || (typeof value.observedMetageneration === 'string' && /^[1-9][0-9]*$/.test(value.observedMetageneration)))
    || !['eligible', 'held', 'delete_reserved', 'deleted'].includes(String(value.state))
    || !Number.isSafeInteger(value.decisionVersion) || (value.decisionVersion as number) < 0
    || !Number.isSafeInteger(value.holdVersion) || (value.holdVersion as number) < 0
    || !Number.isSafeInteger(value.attemptCount) || (value.attemptCount as number) < 0
    || typeof value.legalHoldActive !== 'boolean'
    || typeof value.moderationHoldActive !== 'boolean'
    || typeof value.accountErasureActive !== 'boolean'
    || !(value.reservationToken === null || typeof value.reservationToken === 'string')
    || !(value.reservationOwner === null || typeof value.reservationOwner === 'string')
    || !(value.reservedAt === null || isTimestamp(value.reservedAt))
    || !(value.reservationExpiresAt === null || isTimestamp(value.reservationExpiresAt))
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt) || !isTimestamp(value.lastTransitionAt)
    || typeof value.lastTransitionBy !== 'string'
    || !(value.decisionReason === null || typeof value.decisionReason === 'string')
    || !(value.lastErrorCode === null || typeof value.lastErrorCode === 'string')
    || !(value.deletedAt === null || isTimestamp(value.deletedAt))
    || !(value.deletedGeneration === null || typeof value.deletedGeneration === 'string')) {
    fail('verification_deletion_fence_schema_invalid');
  }

  if (value.state === 'delete_reserved'
    && (typeof value.reservationToken !== 'string' || !value.reservationToken
      || typeof value.reservationOwner !== 'string' || !value.reservationOwner
      || !isTimestamp(value.reservedAt) || !isTimestamp(value.reservationExpiresAt))) {
    fail('verification_deletion_reservation_corrupt');
  }
  if (value.state === 'deleted'
    && (!isTimestamp(value.deletedAt)
      || value.deletedGeneration !== value.observedGeneration
      || typeof value.reservationToken !== 'string' || !value.reservationToken)) {
    fail('verification_deletion_receipt_corrupt');
  }

  return value as unknown as VerificationDeletionFence;
}

export async function createVerificationDeletionFence(
  db: Firestore,
  input: CreateVerificationDeletionFenceInput,
): Promise<VerificationDeletionFence> {
  const fence = buildVerificationDeletionFence(input);
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(fence.objectKey);
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) fail('verification_deletion_fence_already_exists');
    // Create, never merge: UID/path/generation identity is immutable.
    tx.create(ref, fence);
  });
  return fence;
}

export async function readVerificationDeletionFence(
  db: Firestore,
  objectKey: string,
): Promise<VerificationDeletionFence> {
  const key = requireIdentifier(objectKey, 'verification_deletion_object_key_invalid', 128);
  const snapshot = await db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key).get();
  if (!snapshot.exists) fail('verification_deletion_fence_missing');
  return parseFence(snapshot.data(), key);
}

/**
 * Atomically reserves one exact object generation.
 *
 * Hold writers MUST use setVerificationDeletionHold against this same fence
 * document. Firestore transaction retries serialize a concurrent hold and
 * reservation: whichever commits first determines the state observed by the
 * other transaction. This does not protect against unregistered Admin SDK,
 * console, lifecycle, or other external writers.
 */
export async function reserveVerificationDeletion(
  db: Firestore,
  objectKey: string,
  reservationOwner: string,
  reservationTtlMs = DEFAULT_DELETION_RESERVATION_TTL_MS,
): Promise<VerificationDeletionReservation> {
  const key = requireIdentifier(objectKey, 'verification_deletion_object_key_invalid', 128);
  const owner = requireIdentifier(reservationOwner, 'verification_deletion_worker_invalid', 128);
  if (!Number.isSafeInteger(reservationTtlMs) || reservationTtlMs < 1_000 || reservationTtlMs > 60 * 60_000) {
    fail('verification_deletion_reservation_ttl_invalid');
  }

  // randomUUID uses the platform CSPRNG. Generate outside the transaction so
  // Firestore callback retries reuse the same candidate token.
  const reservationToken = randomUUID();
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);
    if (fence.state !== 'eligible') {
      fail(fence.state === 'held'
        ? 'verification_deletion_held'
        : 'verification_deletion_not_eligible');
    }
    if (!/^[1-9][0-9]*$/.test(fence.observedGeneration)) {
      fail('verification_deletion_generation_missing_or_invalid');
    }

    const now = Timestamp.now();
    if (hasActiveHold(fence)) {
      const held: VerificationDeletionFence = {
        ...fence,
        state: 'held',
        decisionVersion: fence.decisionVersion + 1,
        holdVersion: fence.holdVersion + 1,
        decisionReason: 'active_hold_detected_at_reservation',
        updatedAt: now,
        lastTransitionAt: now,
        lastTransitionBy: owner,
        attemptCount: fence.attemptCount + 1,
      };
      tx.set(ref, held);
      return { status: 'held' as const, objectKey: key, fence: held };
    }

    const reserved: VerificationDeletionFence = {
      ...fence,
      state: 'delete_reserved',
      decisionVersion: fence.decisionVersion + 1,
      reservationToken,
      reservationOwner: owner,
      reservedAt: now,
      reservationExpiresAt: Timestamp.fromMillis(now.toMillis() + reservationTtlMs),
      decisionReason: 'deletion_reserved',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: owner,
      attemptCount: fence.attemptCount + 1,
      lastErrorCode: null,
    };
    tx.set(ref, reserved);
    return { status: 'reserved' as const, objectKey: key, reservationToken, fence: reserved };
  });
}

/**
 * Activate a preservation hold through the same transactionally authoritative
 * document as deletion reservation. Holds are monotonic in Package A: release
 * is deliberately not implemented until the legal linearization policy and
 * authorized release workflow are approved.
 *
 * A hold arriving after delete_reserved is rejected with a conflict code and
 * MUST be surfaced as deletion-in-flight; callers must not acknowledge it as
 * an effective hold. No automatic override of the outstanding reservation.
 */
export async function setVerificationDeletionHold(
  db: Firestore,
  objectKey: string,
  holdField: VerificationDeletionHoldField,
  actor: string,
): Promise<VerificationDeletionFence> {
  if (!['legalHoldActive', 'moderationHoldActive', 'accountErasureActive'].includes(holdField)) {
    fail('verification_deletion_hold_field_invalid');
  }
  const key = requireIdentifier(objectKey, 'verification_deletion_object_key_invalid', 128);
  const by = requireIdentifier(actor, 'verification_deletion_actor_invalid', 128);
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);

    if (fence.state === 'delete_reserved') {
      fail('verification_deletion_reservation_in_flight');
    }
    if (fence.state === 'deleted') {
      fail('verification_deletion_already_deleted');
    }

    if (fence[holdField] && fence.state === 'held') return fence;

    const now = Timestamp.now();
    const updated: VerificationDeletionFence = {
      ...fence,
      [holdField]: true,
      state: 'held',
      holdVersion: fence.holdVersion + (fence[holdField] ? 0 : 1),
      decisionVersion: fence.decisionVersion + 1,
      decisionReason: 'preservation_hold_activated',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: by,
    };
    tx.set(ref, updated);
    return updated;
  });
}

/**
 * Record physical deletion only after the GCS API has acknowledged deletion
 * (or an independently verified reconciliation proves the exact generation
 * absent). This helper itself never calls Storage.
 */
export async function markVerificationDeletionComplete(
  db: Firestore,
  objectKey: string,
  reservationToken: string,
  deletedGeneration: string | number,
): Promise<VerificationDeletionFence> {
  const key = requireIdentifier(objectKey, 'verification_deletion_object_key_invalid', 128);
  const token = requireIdentifier(reservationToken, 'verification_deletion_reservation_token_invalid', 128);
  const generation = normalizeGeneration(
    deletedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);

    if (fence.state === 'deleted' && fence.reservationToken === token
      && fence.deletedGeneration === generation) return fence;
    if (fence.state !== 'delete_reserved') fail('verification_deletion_not_reserved');
    if (fence.reservationToken !== token) fail('verification_deletion_fencing_token_mismatch');
    if (generation !== fence.observedGeneration) fail('verification_deletion_generation_changed');

    const now = Timestamp.now();
    const deleted: VerificationDeletionFence = {
      ...fence,
      state: 'deleted',
      decisionVersion: fence.decisionVersion + 1,
      deletedAt: now,
      deletedGeneration: generation,
      decisionReason: 'physical_generation_deletion_confirmed',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: fence.reservationOwner ?? 'unknown',
    };
    tx.set(ref, deleted);
    return deleted;
  });
}
