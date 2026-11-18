import { createHash, randomUUID } from 'node:crypto';
import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

export const VERIFICATION_DELETION_FENCE_COLLECTION = 'verificationDeletionFences';
export const VERIFICATION_DELETION_ATTEMPT_COLLECTION = 'verificationDeletionAttempts';
export const VERIFICATION_DELETION_FENCE_SCHEMA_VERSION = 1 as const;
export const DEFAULT_DELETION_RESERVATION_TTL_MS = 5 * 60_000;

export type VerificationDeletionState =
  | 'eligible'
  | 'hold_pending'
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
  /** A pending hold blocks reservation while its external GCS barrier is staged. */
  pendingHoldField?: VerificationDeletionHoldField | null;
  holdRequestId?: string | null;
  activeDeleteAttemptId?: string | null;
  /** Exact most recent attempt that completed or was absence-reconciled. */
  lastDeleteAttemptId?: string | null;
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


export type VerificationDeleteAttemptStatus = 'pending' | 'succeeded' | 'failed';

export interface VerificationDeleteAttempt {
  schemaVersion: typeof VERIFICATION_DELETION_FENCE_SCHEMA_VERSION;
  attemptId: string;
  objectKey: string;
  uid: string;
  bucket: string;
  storagePath: string;
  reservationToken: string;
  generation: string;
  metageneration: string;
  actor: string;
  status: VerificationDeleteAttemptStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
  errorCode: string | null;
}

export interface LogVerificationDeleteAttemptInput {
  objectKey: string;
  reservationToken: string;
  expectedGeneration: string | number;
  expectedMetageneration: string | number;
  actor: string;
}

export interface LogVerificationDeleteAttemptResult {
  attempt: VerificationDeleteAttempt;
  fence: VerificationDeletionFence;
  /** False means this exact pending attempt already exists and must be reconciled, not replayed. */
  created: boolean;
}

export interface BeginVerificationDeletionHoldInput {
  objectKey: string;
  holdField: VerificationDeletionHoldField;
  actor: string;
  requestId: string;
}

export interface ConfirmVerificationDeletionHoldInput {
  objectKey: string;
  holdField: VerificationDeletionHoldField;
  actor: string;
  requestId: string;
}

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

function requireVerificationStoragePath(value: unknown, uid: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024
    || !value.startsWith(`verification/${uid}/`)
    || value.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('verification_deletion_path_invalid');
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
  const storagePath = requireVerificationStoragePath(input.storagePath, uid);
  const generation = normalizeGeneration(
    input.observedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );

  return createHash('sha256')
    .update([uid, bucket, storagePath, generation].join('\u0000'))
    .digest('hex');
}

function readHoldFlag(value: unknown): boolean {
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
  const storagePath = requireVerificationStoragePath(input.storagePath, uid);
  const observedGeneration = normalizeGeneration(
    input.observedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  const observedMetageneration = input.observedMetageneration == null
    ? null
    : normalizeGeneration(input.observedMetageneration, 'verification_deletion_metageneration_invalid');
  const createdBy = requireIdentifier(input.createdBy, 'verification_deletion_actor_invalid', 128);
  const objectKey = verificationDeletionObjectKey({ uid, bucket, storagePath, observedGeneration });

  const legalHoldActive = readHoldFlag(input.legalHoldActive);
  const moderationHoldActive = readHoldFlag(input.moderationHoldActive);
  const accountErasureActive = readHoldFlag(input.accountErasureActive);
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
    pendingHoldField: null,
    holdRequestId: null,
    activeDeleteAttemptId: null,
    lastDeleteAttemptId: null,
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
    || !['eligible', 'hold_pending', 'held', 'delete_reserved', 'deleted'].includes(String(value.state))
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
    || !(value.deletedGeneration === null || typeof value.deletedGeneration === 'string')
    || !(value.pendingHoldField === undefined || value.pendingHoldField === null
      || ['legalHoldActive', 'moderationHoldActive', 'accountErasureActive'].includes(String(value.pendingHoldField)))
    || !(value.holdRequestId === undefined || value.holdRequestId === null || typeof value.holdRequestId === 'string')
    || !(value.activeDeleteAttemptId === undefined || value.activeDeleteAttemptId === null
      || typeof value.activeDeleteAttemptId === 'string')
    || !(value.lastDeleteAttemptId === undefined || value.lastDeleteAttemptId === null
      || typeof value.lastDeleteAttemptId === 'string')) {
    fail('verification_deletion_fence_schema_invalid');
  }

  const canonicalObjectKey = verificationDeletionObjectKey({
    uid: value.uid,
    bucket: value.bucket,
    storagePath: value.storagePath,
    observedGeneration: value.observedGeneration,
  });
  if (canonicalObjectKey !== expectedObjectKey) {
    fail('verification_deletion_fence_identity_mismatch');
  }
  if ((value.state === 'eligible' || value.state === 'hold_pending' || value.state === 'held')
    && (value.reservationToken !== null || value.reservationOwner !== null
      || value.reservedAt !== null || value.reservationExpiresAt !== null)) {
    fail('verification_deletion_reservation_corrupt');
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
 * document as deletion reservation. A hold wins over any outstanding
 * reservation: it atomically clears the reservation token/owner/timestamps and
 * transitions the fence to held. A worker holding the old token must fail its
 * final reservation verification before issuing a Storage delete.
 *
 * Hold release remains intentionally unsupported pending an approved legal
 * release workflow. A hold cannot resurrect an already-deleted generation.
 */
export async function setVerificationDeletionHold(
  db: Firestore,
  objectKey: string,
  holdField: VerificationDeletionHoldField,
  actor: string,
): Promise<VerificationDeletionFence> {
  // Keep the legacy signature for source compatibility, but make its
  // arguments explicit to noUnusedParameters while preserving fail-closed behavior.
  void db;
  void objectKey;
  void holdField;
  void actor;
  throw new Error('legacy_disabled_gcs_fencing_required');
}



/**
 * Begin a two-phase hold. This transaction immediately invalidates any
 * outstanding deletion reservation and places the fence in hold_pending.
 * The caller must establish and verify the corresponding GCS hold before
 * calling confirmVerificationDeletionHold.
 */
export async function beginVerificationDeletionHold(
  db: Firestore,
  input: BeginVerificationDeletionHoldInput,
): Promise<VerificationDeletionFence> {
  if (!['legalHoldActive', 'moderationHoldActive', 'accountErasureActive'].includes(input.holdField)) {
    fail('verification_deletion_hold_field_invalid');
  }
  const key = requireIdentifier(input.objectKey, 'verification_deletion_object_key_invalid', 128);
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const requestId = requireIdentifier(input.requestId, 'verification_deletion_hold_request_invalid', 128);
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);
    if (fence.state === 'deleted') fail('verification_deletion_already_deleted');

    if (fence.state === 'hold_pending') {
      if (fence.pendingHoldField === input.holdField
        && fence.holdRequestId === requestId) return fence;
      fail('verification_deletion_hold_pending_conflict');
    }

    const now = Timestamp.now();
    const pending: VerificationDeletionFence = {
      ...fence,
      state: 'hold_pending',
      pendingHoldField: input.holdField,
      holdRequestId: requestId,
      reservationToken: null,
      reservationOwner: null,
      reservedAt: null,
      reservationExpiresAt: null,
      activeDeleteAttemptId: null,
      holdVersion: fence.holdVersion + 1,
      decisionVersion: fence.decisionVersion + 1,
      decisionReason: 'preservation_hold_pending_gcs_confirmation',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: actor,
    };
    tx.set(ref, pending);
    return pending;
  });
}

/** Confirm a pending hold only after the caller has verified the GCS barrier. */
export async function confirmVerificationDeletionHold(
  db: Firestore,
  input: ConfirmVerificationDeletionHoldInput,
): Promise<VerificationDeletionFence> {
  if (!['legalHoldActive', 'moderationHoldActive', 'accountErasureActive'].includes(input.holdField)) {
    fail('verification_deletion_hold_field_invalid');
  }
  const key = requireIdentifier(input.objectKey, 'verification_deletion_object_key_invalid', 128);
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const requestId = requireIdentifier(input.requestId, 'verification_deletion_hold_request_invalid', 128);
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);

    if (fence.state === 'held' && fence[input.holdField] && fence.holdRequestId === requestId) {
      return fence;
    }
    if (fence.state !== 'hold_pending'
      || fence.pendingHoldField !== input.holdField
      || fence.holdRequestId !== requestId) {
      fail('verification_deletion_hold_pending_mismatch');
    }

    const now = Timestamp.now();
    const held: VerificationDeletionFence = {
      ...fence,
      [input.holdField]: true,
      state: 'held',
      pendingHoldField: null,
      decisionVersion: fence.decisionVersion + 1,
      decisionReason: 'preservation_hold_confirmed_after_gcs_barrier',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: actor,
    };
    tx.set(ref, held);
    return held;
  });
}


/**
 * Revalidate the exact reservation capability immediately before a destructive
 * Storage call. This is a Firestore transaction, not a cross-service atomic
 * lock: every hold writer must use the same fence and the residual interval
 * between this transaction and the GCS request remains an external-writer /
 * distributed-systems risk requiring separate fencing controls.
 */
export async function verifyVerificationDeletionReservation(
  db: Firestore,
  objectKey: string,
  reservationToken: string,
  expectedGeneration: string | number,
): Promise<VerificationDeletionFence> {
  const key = requireIdentifier(objectKey, 'verification_deletion_object_key_invalid', 128);
  const token = requireIdentifier(reservationToken, 'verification_deletion_reservation_token_invalid', 128);
  const generation = normalizeGeneration(
    expectedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  const ref = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);
    if (fence.state !== 'delete_reserved') fail('verification_deletion_not_reserved');
    if (fence.reservationToken !== token) fail('verification_deletion_fencing_token_mismatch');
    if (fence.observedGeneration !== generation) fail('verification_deletion_generation_changed');
    if (hasActiveHold(fence)) fail('verification_deletion_hold_conflicts_with_reservation');
    if (!fence.reservationExpiresAt || fence.reservationExpiresAt.toMillis() <= Date.now()) {
      fail('verification_deletion_reservation_expired');
    }
    return fence;
  });
}


/**
 * Persist a durable attempt before the GCS delete. The attempt is bound to the
 * exact reservation token, generation and metageneration supplied by the
 * caller. A hold transaction and this transaction serialize on the fence doc.
 */
export async function logVerificationDeleteAttempt(
  db: Firestore,
  input: LogVerificationDeleteAttemptInput,
): Promise<LogVerificationDeleteAttemptResult> {
  const key = requireIdentifier(input.objectKey, 'verification_deletion_object_key_invalid', 128);
  const token = requireIdentifier(input.reservationToken, 'verification_deletion_reservation_token_invalid', 128);
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const generation = normalizeGeneration(input.expectedGeneration, 'verification_deletion_generation_missing_or_invalid');
  const metageneration = normalizeGeneration(input.expectedMetageneration, 'verification_deletion_metageneration_invalid');
  const attemptId = randomUUID();
  const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);
  const newAttemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION).doc(attemptId);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(fenceRef);
    if (!snapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(snapshot.data(), key);
    if (fence.state !== 'delete_reserved') fail('verification_deletion_not_reserved');
    if (fence.reservationToken !== token) fail('verification_deletion_fencing_token_mismatch');
    if (fence.observedGeneration !== generation) fail('verification_deletion_generation_changed');
    if (fence.observedMetageneration !== metageneration) fail('verification_deletion_metageneration_changed');
    if (hasActiveHold(fence)) fail('verification_deletion_hold_conflicts_with_reservation');
    // Idempotent replay: an existing pending attempt is returned only when
    // every destructive-operation parameter is identical. Callers must not
    // issue another GCS request when created === false; reconcile this attempt.
    if (fence.activeDeleteAttemptId) {
      const activeAttemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION)
        .doc(fence.activeDeleteAttemptId);
      const activeSnapshot = await tx.get(activeAttemptRef);
      if (!activeSnapshot.exists) fail('verification_deletion_active_attempt_missing');
      const raw = activeSnapshot.data();
      if (!isRecord(raw)
        || raw.schemaVersion !== VERIFICATION_DELETION_FENCE_SCHEMA_VERSION
        || raw.attemptId !== fence.activeDeleteAttemptId
        || raw.objectKey !== key
        || raw.uid !== fence.uid
        || raw.bucket !== fence.bucket
        || raw.storagePath !== fence.storagePath
        || raw.reservationToken !== token
        || raw.generation !== generation
        || raw.metageneration !== metageneration
        || raw.actor !== actor
        || raw.status !== 'pending'
        || !isTimestamp(raw.createdAt)
        || !isTimestamp(raw.updatedAt)
        || raw.completedAt !== null
        || raw.errorCode !== null) {
        fail('verification_deletion_attempt_conflict');
      }
      return {
        attempt: raw as unknown as VerificationDeleteAttempt,
        fence,
        created: false,
      };
    }

    if (!fence.reservationExpiresAt || fence.reservationExpiresAt.toMillis() <= Date.now()) {
      fail('verification_deletion_reservation_expired');
    }

    const now = Timestamp.now();
    const attempt: VerificationDeleteAttempt = {
      schemaVersion: VERIFICATION_DELETION_FENCE_SCHEMA_VERSION,
      attemptId,
      objectKey: key,
      uid: fence.uid,
      bucket: fence.bucket,
      storagePath: fence.storagePath,
      reservationToken: token,
      generation,
      metageneration,
      actor,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      errorCode: null,
    };
    const updatedFence: VerificationDeletionFence = {
      ...fence,
      activeDeleteAttemptId: attemptId,
      attemptCount: fence.attemptCount + 1,
      updatedAt: now,
      lastTransitionBy: actor,
    };
    tx.create(newAttemptRef, attempt);
    tx.set(fenceRef, updatedFence);
    return { attempt, fence: updatedFence, created: true };
  });
}


export interface PrepareVerificationDeleteCasInput extends CreateVerificationDeletionFenceInput {
  /** Required for the GCS compare-and-swap ticket. */
  observedMetageneration: string | number;
  actor: string;
  reservationOwner: string;
  reservationTtlMs?: number;
}

export type VerificationDeleteCasBlockedReason =
  | 'verification_deletion_held'
  | 'verification_deletion_hold_pending'
  | 'verification_deletion_already_deleted'
  | 'verification_deletion_not_eligible'
  | 'verification_deletion_reservation_owned_by_other_worker'
  | 'verification_deletion_reservation_expired'
  | 'verification_deletion_attempt_already_pending'
  | 'verification_deletion_attempt_conflict'
  | 'verification_deletion_fence_identity_mismatch'
  | 'verification_deletion_metageneration_changed';

export type PrepareVerificationDeleteCasResult =
  | {
      readyForGcs: true;
      objectKey: string;
      reservationToken: string;
      generation: string;
      metageneration: string;
      attempt: VerificationDeleteAttempt;
      fence: VerificationDeletionFence;
      created: true;
    }
  | {
      readyForGcs: false;
      reason: VerificationDeleteCasBlockedReason;
      objectKey?: string;
      attempt?: VerificationDeleteAttempt;
      fence?: VerificationDeletionFence;
      created?: false;
    };

function prepareConflictReason(error: unknown): VerificationDeleteCasBlockedReason | null {
  if (!(error instanceof VerificationDeletionFenceError)) return null;
  switch (error.code) {
    case 'verification_deletion_held':
    case 'verification_deletion_hold_conflicts_with_reservation':
      return 'verification_deletion_held';
    case 'verification_deletion_hold_pending_mismatch':
      return 'verification_deletion_hold_pending';
    case 'verification_deletion_already_deleted':
      return 'verification_deletion_already_deleted';
    case 'verification_deletion_not_eligible':
    case 'verification_deletion_not_reserved':
      return 'verification_deletion_not_eligible';
    case 'verification_deletion_reservation_expired':
      return 'verification_deletion_reservation_expired';
    case 'verification_deletion_metageneration_changed':
      return 'verification_deletion_metageneration_changed';
    case 'verification_deletion_attempt_conflict':
    case 'verification_deletion_active_attempt_missing':
      return 'verification_deletion_attempt_conflict';
    default:
      return null;
  }
}

async function blockedByLatestFence(
  db: Firestore,
  objectKey: string,
  fallbackReason: VerificationDeleteCasBlockedReason,
  reservationOwner: string,
): Promise<PrepareVerificationDeleteCasResult> {
  const latest = await readVerificationDeletionFence(db, objectKey);
  let attempt: VerificationDeleteAttempt | undefined;
  let reason: VerificationDeleteCasBlockedReason;

  if (latest.activeDeleteAttemptId) {
    const attemptSnapshot = await db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION)
      .doc(latest.activeDeleteAttemptId).get();
    const raw = attemptSnapshot.data();
    if (attemptSnapshot.exists && isRecord(raw)
      && raw.attemptId === latest.activeDeleteAttemptId
      && raw.objectKey === objectKey
      && raw.status === 'pending') {
      attempt = raw as unknown as VerificationDeleteAttempt;
      reason = hasActiveHold(latest)
        ? 'verification_deletion_held'
        : 'verification_deletion_attempt_already_pending';
    } else {
      reason = 'verification_deletion_attempt_conflict';
    }
  } else {
    reason = latest.state === 'held'
      ? 'verification_deletion_held'
      : latest.state === 'hold_pending'
        ? 'verification_deletion_hold_pending'
        : latest.state === 'deleted'
          ? 'verification_deletion_already_deleted'
          : latest.state === 'delete_reserved' && latest.reservationOwner !== reservationOwner
            ? 'verification_deletion_reservation_owned_by_other_worker'
            : fallbackReason;
  }

  return {
    readyForGcs: false,
    reason,
    objectKey,
    fence: latest,
    ...(attempt ? { attempt, created: false as const } : {}),
  };
}

/**
 * Prepare the Firestore-side CAS ticket for one exact GCS object generation.
 * This helper never calls GCS. Existing pending attempts are surfaced as a
 * non-ready reconciliation result and must not trigger a second delete.
 */
export async function prepareVerificationDeleteCas(
  db: Firestore,
  input: PrepareVerificationDeleteCasInput,
): Promise<PrepareVerificationDeleteCasResult> {
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const reservationOwner = requireIdentifier(
    input.reservationOwner,
    'verification_deletion_worker_invalid',
    128,
  );
  const generation = normalizeGeneration(
    input.observedGeneration,
    'verification_deletion_generation_missing_or_invalid',
  );
  const metageneration = normalizeGeneration(
    input.observedMetageneration,
    'verification_deletion_metageneration_invalid',
  );
  const createInput: CreateVerificationDeletionFenceInput = {
    uid: input.uid,
    challengeId: input.challengeId,
    bucket: input.bucket,
    storagePath: input.storagePath,
    observedGeneration: generation,
    observedMetageneration: metageneration,
    legalHoldActive: input.legalHoldActive,
    moderationHoldActive: input.moderationHoldActive,
    accountErasureActive: input.accountErasureActive,
    createdBy: input.createdBy,
  };
  const proposed = buildVerificationDeletionFence(createInput);
  const objectKey = proposed.objectKey;

  let fence: VerificationDeletionFence;
  try {
    fence = await createVerificationDeletionFence(db, createInput);
  } catch (error) {
    if (!(error instanceof VerificationDeletionFenceError)
      || error.code !== 'verification_deletion_fence_already_exists') {
      const reason = prepareConflictReason(error);
      if (reason) return { readyForGcs: false, reason, objectKey };
      throw error;
    }
    fence = await readVerificationDeletionFence(db, objectKey);
  }

  // The deterministic key intentionally binds UID/bucket/path/generation.
  // Check the remaining immutable identity separately, including challenge
  // and metageneration, so a changed metadata version is never silently reused.
  if (fence.uid !== input.uid
    || fence.challengeId !== input.challengeId
    || fence.bucket !== input.bucket
    || fence.storagePath !== input.storagePath
    || fence.observedGeneration !== generation
    || fence.observedMetageneration !== metageneration) {
    return {
      readyForGcs: false,
      reason: fence.observedMetageneration !== metageneration
        ? 'verification_deletion_metageneration_changed'
        : 'verification_deletion_fence_identity_mismatch',
      objectKey,
      fence,
    };
  }

  let reservationToken: string;
  let reservedFence: VerificationDeletionFence;

  if (fence.state === 'eligible') {
    try {
      const reservation = await reserveVerificationDeletion(
        db,
        objectKey,
        reservationOwner,
        input.reservationTtlMs,
      );
      if (reservation.status !== 'reserved') {
        return {
          readyForGcs: false,
          reason: 'verification_deletion_held',
          objectKey,
          fence: reservation.fence,
        };
      }
      reservationToken = reservation.reservationToken;
      reservedFence = reservation.fence;
    } catch (error) {
      const reason = prepareConflictReason(error);
      if (reason) {
        if (error instanceof VerificationDeletionFenceError
          && ['verification_deletion_held', 'verification_deletion_not_eligible'].includes(error.code)) {
          return blockedByLatestFence(db, objectKey, reason, reservationOwner);
        }
        return { readyForGcs: false, reason, objectKey };
      }
      throw error;
    }
  } else if (fence.state === 'delete_reserved') {
    if (fence.reservationOwner !== reservationOwner || !fence.reservationToken) {
      return {
        readyForGcs: false,
        reason: 'verification_deletion_reservation_owned_by_other_worker',
        objectKey,
        fence,
      };
    }
    if ((!fence.reservationExpiresAt || fence.reservationExpiresAt.toMillis() <= Date.now())
      && !fence.activeDeleteAttemptId) {
      return {
        readyForGcs: false,
        reason: 'verification_deletion_reservation_expired',
        objectKey,
        fence,
      };
    }
    reservationToken = fence.reservationToken;
    reservedFence = fence;
  } else {
    const reason: VerificationDeleteCasBlockedReason = fence.state === 'held'
      ? 'verification_deletion_held'
      : fence.state === 'hold_pending'
        ? 'verification_deletion_hold_pending'
        : 'verification_deletion_already_deleted';
    return { readyForGcs: false, reason, objectKey, fence };
  }

  try {
    const logged = await logVerificationDeleteAttempt(db, {
      objectKey,
      reservationToken,
      expectedGeneration: generation,
      expectedMetageneration: metageneration,
      actor,
    });
    if (!logged.created) {
      return {
        readyForGcs: false,
        reason: 'verification_deletion_attempt_already_pending',
        objectKey,
        attempt: logged.attempt,
        fence: logged.fence,
        created: false,
      };
    }
    return {
      readyForGcs: true,
      objectKey,
      reservationToken,
      generation,
      metageneration,
      attempt: logged.attempt,
      fence: logged.fence ?? reservedFence,
      created: true,
    };
  } catch (error) {
    const reason = prepareConflictReason(error);
    if (reason) {
      if (error instanceof VerificationDeletionFenceError
        && [
          'verification_deletion_held',
          'verification_deletion_hold_conflicts_with_reservation',
          'verification_deletion_not_reserved',
          'verification_deletion_not_eligible',
        ].includes(error.code)) {
        return blockedByLatestFence(db, objectKey, reason, reservationOwner);
      }
      return { readyForGcs: false, reason, objectKey, fence: reservedFence };
    }
    throw error;
  }
}

/**
 * Write the durable receipt only after the caller receives a successful GCS
 * conditional-delete response. This records the exact attempt and generation.
 */
export async function writeVerificationDeletionReceipt(
  db: Firestore,
  attemptId: string,
  deletedGeneration: string | number,
  actor: string,
): Promise<VerificationDeletionFence> {
  const id = requireIdentifier(attemptId, 'verification_deletion_attempt_id_invalid', 128);
  const generation = normalizeGeneration(deletedGeneration, 'verification_deletion_generation_missing_or_invalid');
  const by = requireIdentifier(actor, 'verification_deletion_actor_invalid', 128);
  const attemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION).doc(id);

  return db.runTransaction(async tx => {
    const attemptSnapshot = await tx.get(attemptRef);
    if (!attemptSnapshot.exists) fail('verification_deletion_attempt_missing');
    const rawAttempt = attemptSnapshot.data();
    if (!isRecord(rawAttempt)
      || rawAttempt.attemptId !== id
      || rawAttempt.status !== 'pending'
      || typeof rawAttempt.objectKey !== 'string'
      || typeof rawAttempt.reservationToken !== 'string'
      || typeof rawAttempt.generation !== 'string') {
      fail('verification_deletion_attempt_corrupt_or_not_pending');
    }
    const key = requireIdentifier(rawAttempt.objectKey, 'verification_deletion_object_key_invalid', 128);
    const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);
    const fenceSnapshot = await tx.get(fenceRef);
    if (!fenceSnapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(fenceSnapshot.data(), key);

    if (generation !== rawAttempt.generation || generation !== fence.observedGeneration) {
      fail('verification_deletion_generation_changed');
    }
    if (fence.state !== 'delete_reserved'
      || fence.reservationToken !== rawAttempt.reservationToken
      || fence.activeDeleteAttemptId !== id) {
      fail('verification_deletion_receipt_attempt_mismatch');
    }
    if (hasActiveHold(fence)) fail('verification_deletion_hold_conflicts_with_reservation');

    const now = Timestamp.now();
    const deleted: VerificationDeletionFence = {
      ...fence,
      state: 'deleted',
      activeDeleteAttemptId: null,
      decisionVersion: fence.decisionVersion + 1,
      deletedAt: now,
      deletedGeneration: generation,
      lastDeleteAttemptId: id,
      decisionReason: 'conditional_gcs_delete_receipt_recorded',
      updatedAt: now,
      lastTransitionAt: now,
      lastTransitionBy: by,
    };
    const completedAttempt: VerificationDeleteAttempt = {
      ...(rawAttempt as unknown as VerificationDeleteAttempt),
      status: 'succeeded',
      updatedAt: now,
      completedAt: now,
      errorCode: null,
    };
    tx.set(fenceRef, deleted);
    tx.set(attemptRef, completedAttempt);
    return deleted;
  });
}



/**
 * Close an attempt only when the outcome proves no conditional deletion was
 * accepted, such as GCS 412 or a pre-delete guard rejection. Ambiguous provider
 * failures remain pending and must not trigger a duplicate destructive request.
 */
export async function failVerificationDeletionAttempt(
  db: Firestore, attemptId: string, actor: string, errorCode: string,
): Promise<boolean> {
  const id = requireIdentifier(attemptId, 'verification_deletion_attempt_id_invalid', 128);
  const by = requireIdentifier(actor, 'verification_deletion_actor_invalid', 128);
  const reason = requireIdentifier(errorCode, 'verification_deletion_attempt_error_invalid', 128);
  const attemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION).doc(id);
  return db.runTransaction(async tx => {
    const attemptSnapshot = await tx.get(attemptRef);
    if (!attemptSnapshot.exists) fail('verification_deletion_attempt_missing');
    const rawAttempt = attemptSnapshot.data();
    if (!isRecord(rawAttempt) || rawAttempt.attemptId !== id
      || typeof rawAttempt.objectKey !== 'string'
      || typeof rawAttempt.reservationToken !== 'string'
      || typeof rawAttempt.generation !== 'string'
      || typeof rawAttempt.metageneration !== 'string') fail('verification_deletion_attempt_corrupt');
    if (rawAttempt.status !== 'pending') return false;
    const key = requireIdentifier(rawAttempt.objectKey, 'verification_deletion_object_key_invalid', 128);
    const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);
    const fenceSnapshot = await tx.get(fenceRef);
    if (!fenceSnapshot.exists) fail('verification_deletion_fence_missing');
    const fence = parseFence(fenceSnapshot.data(), key);
    const now = Timestamp.now();
    tx.set(attemptRef, {
      ...(rawAttempt as unknown as VerificationDeleteAttempt),
      status: 'failed', updatedAt: now, completedAt: now, errorCode: reason,
    });
    if (fence.activeDeleteAttemptId === id && fence.state === 'delete_reserved'
      && fence.reservationToken === rawAttempt.reservationToken) {
      const held = hasActiveHold(fence);
      tx.set(fenceRef, {
        ...fence,
        state: held ? 'held' : 'eligible',
        reservationToken: null, reservationOwner: null, reservedAt: null,
        reservationExpiresAt: null, activeDeleteAttemptId: null,
        decisionVersion: fence.decisionVersion + 1,
        decisionReason: held ? 'failed_attempt_closed_with_preservation_hold' : 'failed_attempt_closed_for_safe_retry',
        updatedAt: now, lastTransitionAt: now, lastTransitionBy: by, lastErrorCode: reason,
      });
    }
    return true;
  });
}

/**
 * A live successor lease may take over an attempt whose prior scanner no longer
 * owns the singleton purge lease. GCS CAS arbitrates requests already in flight.
 */
export async function reclaimVerificationDeletionAttemptForActiveWorker(
  db: Firestore,
  input: { objectKey: string; activeWorkerLeaseId: string; workerLeaseRef: DocumentReference; actor: string },
): Promise<boolean> {
  const key = requireIdentifier(input.objectKey, 'verification_deletion_object_key_invalid', 128);
  const owner = requireIdentifier(input.activeWorkerLeaseId, 'verification_deletion_worker_invalid', 128);
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(key);
  return db.runTransaction(async tx => {
    const [leaseSnapshot, fenceSnapshot] = await Promise.all([tx.get(input.workerLeaseRef), tx.get(fenceRef)]);
    const lease = leaseSnapshot.data();
    if (!isRecord(lease) || lease.leaseId !== owner || !isTimestamp(lease.leaseUntil)
      || lease.leaseUntil.toMillis() <= Date.now()) fail('verification_deletion_successor_lease_not_active');
    if (!fenceSnapshot.exists) return false;
    const fence = parseFence(fenceSnapshot.data(), key);
    if (fence.state !== 'delete_reserved' || fence.reservationOwner === owner) return false;
    if (fence.activeDeleteAttemptId) {
      const oldRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION).doc(fence.activeDeleteAttemptId);
      const oldSnapshot = await tx.get(oldRef);
      const old = oldSnapshot.data();
      if (!oldSnapshot.exists || !isRecord(old) || old.attemptId !== fence.activeDeleteAttemptId
        || old.objectKey !== key || old.reservationToken !== fence.reservationToken
        || old.generation !== fence.observedGeneration || old.metageneration !== fence.observedMetageneration
        || old.status !== 'pending') fail('verification_deletion_stale_attempt_conflict');
      const now = Timestamp.now();
      tx.set(oldRef, { ...old, status: 'failed', updatedAt: now, completedAt: now,
        errorCode: 'superseded_by_active_purge_lease' });
    }
    const now = Timestamp.now();
    const held = hasActiveHold(fence);
    tx.set(fenceRef, {
      ...fence, state: held ? 'held' : 'eligible',
      reservationToken: null, reservationOwner: null, reservedAt: null,
      reservationExpiresAt: null, activeDeleteAttemptId: null,
      decisionVersion: fence.decisionVersion + 1,
      decisionReason: held ? 'stale_attempt_reclaimed_with_preservation_hold' : 'stale_attempt_reclaimed_by_successor_lease',
      updatedAt: now, lastTransitionAt: now, lastTransitionBy: actor,
      lastErrorCode: 'superseded_by_active_purge_lease',
    });
    return true;
  });
}

/**
 * Complete the fence after a durable intent and independently confirmed 404.
 * A pending exact attempt is completed; after a definitive 412 a synthetic
 * reconciliation receipt records that the generation is now absent.
 */
export async function reconcileVerificationDeletionAbsence(
  db: Firestore,
  input: { uid: string; challengeId: string; bucket: string; storagePath: string;
    generation: string | number; metageneration?: string | number; actor: string },
): Promise<{ objectKey: string; attemptId: string | null } | null> {
  const generation = normalizeGeneration(input.generation, 'verification_deletion_generation_missing_or_invalid');
  const actor = requireIdentifier(input.actor, 'verification_deletion_actor_invalid', 128);
  const objectKey = verificationDeletionObjectKey({
    uid: input.uid, bucket: input.bucket, storagePath: input.storagePath, observedGeneration: generation,
  });
  const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION).doc(objectKey);
  return db.runTransaction(async tx => {
    const fenceSnapshot = await tx.get(fenceRef);
    if (!fenceSnapshot.exists) return null;
    const fence = parseFence(fenceSnapshot.data(), objectKey);
    if (fence.uid !== input.uid || fence.challengeId !== input.challengeId
      || fence.bucket !== input.bucket || fence.storagePath !== input.storagePath
      || fence.observedGeneration !== generation || fence.observedMetageneration === null
      || (input.metageneration !== undefined && fence.observedMetageneration !== normalizeGeneration(
        input.metageneration, 'verification_deletion_metageneration_invalid'))) {
      fail('verification_deletion_absence_identity_mismatch');
    }
    if (fence.state === 'deleted') {
      if (fence.deletedGeneration !== generation) fail('verification_deletion_absence_generation_mismatch');
      return { objectKey, attemptId: fence.lastDeleteAttemptId ?? null };
    }
    if (fence.state === 'held' || fence.state === 'hold_pending' || hasActiveHold(fence)) {
      fail('verification_deletion_absence_blocked_by_hold');
    }
    if (fence.state !== 'eligible' && fence.state !== 'delete_reserved') {
      fail('verification_deletion_absence_state_invalid');
    }
    const now = Timestamp.now();
    const token = fence.reservationToken ?? randomUUID();
    const attemptId = fence.activeDeleteAttemptId ?? randomUUID();
    const attemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION).doc(attemptId);
    if (fence.activeDeleteAttemptId) {
      const attemptSnapshot = await tx.get(attemptRef);
      const raw = attemptSnapshot.data();
      if (!attemptSnapshot.exists || !isRecord(raw) || raw.attemptId !== attemptId
        || raw.objectKey !== objectKey || raw.reservationToken !== token
        || raw.generation !== generation || raw.metageneration !== fence.observedMetageneration
        || raw.status !== 'pending') fail('verification_deletion_absence_attempt_mismatch');
      tx.set(attemptRef, { ...raw, status: 'succeeded', updatedAt: now, completedAt: now, errorCode: null });
    } else {
      const synthetic: VerificationDeleteAttempt = {
        schemaVersion: VERIFICATION_DELETION_FENCE_SCHEMA_VERSION, attemptId, objectKey,
        uid: fence.uid, bucket: fence.bucket, storagePath: fence.storagePath,
        reservationToken: token, generation, metageneration: fence.observedMetageneration,
        actor, status: 'succeeded', createdAt: now, updatedAt: now, completedAt: now, errorCode: null,
      };
      tx.create(attemptRef, synthetic);
    }
    const completed: VerificationDeletionFence = {
      ...fence, state: 'deleted', reservationToken: token,
      reservationOwner: fence.reservationOwner ?? actor,
      reservedAt: fence.reservedAt ?? now,
      reservationExpiresAt: fence.reservationExpiresAt ?? now,
      activeDeleteAttemptId: null, lastDeleteAttemptId: attemptId,
      decisionVersion: fence.decisionVersion + 1, deletedAt: now, deletedGeneration: generation,
      decisionReason: 'generation_absence_reconciled_after_durable_intent',
      updatedAt: now, lastTransitionAt: now, lastTransitionBy: actor, lastErrorCode: null,
    };
    tx.set(fenceRef, completed);
    return { objectKey, attemptId };
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
  // Keep the legacy signature for source compatibility; destructive legacy
  // completion remains disabled and these values are intentionally unused.
  void db;
  void objectKey;
  void reservationToken;
  void deletedGeneration;
  throw new Error('legacy_disabled_gcs_fencing_required');
}
