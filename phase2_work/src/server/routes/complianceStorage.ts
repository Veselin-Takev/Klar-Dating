import express, { Router } from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readPurgeCursor, scanPurgePages } from '../platform/verificationPurgeScan';
import { executeVerificationRetentionBatch, isVerificationArtifactExpired, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';
import { logSafeFailure } from '../safeErrorLog';
import {
  prepareVerificationDeleteCas,
  verifyVerificationDeletionReservation,
  writeVerificationDeletionReceipt,
  VERIFICATION_DELETION_ATTEMPT_COLLECTION,
  VERIFICATION_DELETION_FENCE_COLLECTION,
} from '../platform/verificationDeletionFence';

const MAX_BATCH = 25;
const MAX_PAGES = 4;
const LEASE_MS = 5 * 60_000;
const MAX_SCAN_MS = 100_000;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

// GCS generations and metagenerations are opaque decimal identifiers.
// Both are mandatory: the delete call must compare-and-swap both values.
export interface VerificationStorageMetadata {
  generation: string | number;
  metageneration: string | number;
  temporaryHold?: unknown;
  eventBasedHold?: unknown;
}

export type VerificationStorageFile = {
  getMetadata: () => Promise<[VerificationStorageMetadata, ...unknown[]]>;
  delete: (options: {
    ifGenerationMatch: string | number;
    ifMetagenerationMatch: string | number;
  }) => Promise<unknown>;
};

// SDK metadata marks generation fields optional even though GCS supplies them.
// Keep the SDK boundary broad and enforce the required fields at runtime.
type VerificationStorageFileLike = {
  getMetadata: () => Promise<[unknown, ...unknown[]]>;
  delete: (options: {
    ifGenerationMatch: string | number;
    ifMetagenerationMatch: string | number;
  }) => Promise<unknown>;
};

function isValidStorageVersion(value: unknown): value is string | number {
  return (typeof value === 'string' || typeof value === 'number')
    && /^[1-9][0-9]*$/.test(String(value))
    && (typeof value !== 'number' || Number.isSafeInteger(value));
}

export async function inspectVerificationStorageMetadata(
  file: VerificationStorageFileLike,
): Promise<{ generation: string | number; metageneration: string | number }> {
  const [metadataValue] = await file.getMetadata();
  // Provider metadata is a trust boundary. Unexpected present values are not
  // permission to destroy sensitive verification media.
  if (typeof metadataValue !== 'object' || metadataValue === null || Array.isArray(metadataValue)) {
    throw new Error('verification_photo_metadata_or_hold_invalid');
  }
  const metadata = metadataValue as Record<string, unknown>;
  if ((metadata.temporaryHold !== undefined && metadata.temporaryHold !== false)
    || (metadata.eventBasedHold !== undefined && metadata.eventBasedHold !== false)) {
    throw new Error('verification_photo_metadata_or_hold_invalid');
  }
  if (!isValidStorageVersion(metadata.generation)) {
    throw new Error('verification_photo_generation_missing');
  }
  if (!isValidStorageVersion(metadata.metageneration)) {
    throw new Error('verification_photo_metageneration_missing');
  }
  return {
    generation: metadata.generation,
    metageneration: metadata.metageneration,
  };
}

export async function inspectVerificationStorageGeneration(
  file: VerificationStorageFileLike,
): Promise<string | number> {
  return (await inspectVerificationStorageMetadata(file)).generation;
}

export async function deleteVerificationStorageFile(
  file: VerificationStorageFileLike,
  expectedGeneration: string | number | undefined,
  beforeDelete: () => Promise<void>,
  expectedMetageneration?: string | number,
): Promise<void> {
  // Destructive helper is exported: deny accidental direct callers bypassing
  // the final authorization hook, even from untyped JavaScript consumers.
  // This does NOT close the cross-service hold race after authorization.
  if (typeof beforeDelete !== 'function') {
    throw new Error('verification_photo_final_authorization_missing');
  }
  const metadata = await inspectVerificationStorageMetadata(file);
  if (expectedGeneration !== undefined && String(metadata.generation) !== String(expectedGeneration)) {
    throw new Error('verification_photo_generation_changed');
  }
  if (expectedMetageneration !== undefined
    && String(metadata.metageneration) !== String(expectedMetageneration)) {
    throw new Error('verification_photo_metageneration_changed');
  }
  // Revalidate Firestore authorization after the last Storage metadata read.
  // A cross-service update after this callback still needs operational fencing.
  await beforeDelete();
  await file.delete({
    ifGenerationMatch: metadata.generation,
    ifMetagenerationMatch: metadata.metageneration,
  });
}

type PurgeIntent = {
  generation: string;
  storagePath: string;
  decidedAt: number;
  status: 'approved' | 'rejected';
};

type PurgeProof = {
  generation: string;
  method: 'delete_acknowledged' | 'absence_reconciled';
  attemptId?: string;
  objectKey?: string;
};

function isStorageNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 404 || code === '404';
}

function isStoragePreconditionFailed(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 412 || code === '412';
}

/**
 * A persisted intent proves that this worker attempted a deletion, not that a
 * missing object will remain absent. Confirm absence again immediately before
 * finalizing an absence-reconciled audit receipt.
 */
export async function confirmVerificationStorageAbsence(
  file: { getMetadata: () => Promise<[unknown, ...unknown[]]> },
): Promise<void> {
  try {
    await file.getMetadata();
  } catch (error) {
    if (isStorageNotFound(error)) return;
    throw error;
  }
  throw new Error('verification_photo_absence_no_longer_confirmed');
}

function readMatchingPurgeIntent(value: unknown, artifact: VerificationArtifactRecord): PurgeIntent | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new Error('verification_purge_intent_invalid');
  const data = value as Record<string, unknown>;
  if (typeof data.generation !== 'string' || !/^[1-9][0-9]*$/.test(data.generation)
    || data.storagePath !== artifact.storagePath
    || data.decidedAt !== artifact.decidedAt
    || data.status !== artifact.status) {
    throw new Error('verification_purge_intent_mismatch');
  }
  return {
    generation: data.generation, storagePath: artifact.storagePath,
    decidedAt: artifact.decidedAt, status: artifact.status as 'approved' | 'rejected',
  };
}

/**
 * Fail closed when legacy and canonical decision fields disagree. Choosing
 * entscheidung by nullish precedence silently ignores a pending/revoked status.
 * The same decoder must be used at scan time and immediately before deletion.
 */
export function readConsistentVerificationDecision(
  data: Record<string, unknown>,
): VerificationArtifactRecord['status'] {
  const decode = (value: unknown): VerificationArtifactRecord['status'] | null => {
    if (value == null) return null;
    if (value === 'bestaetigt' || value === 'approved') return 'approved';
    if (value === 'abgelehnt' || value === 'rejected') return 'rejected';
    return 'pending'; // Unrecognized values never grant purge eligibility.
  };
  const canonical = decode(data.entscheidung);
  const legacy = decode(data.status);
  if (canonical && legacy && canonical !== legacy) {
    throw new Error('verification_photo_decision_conflict');
  }
  return canonical ?? legacy ?? 'pending';
}

/** Record-level preservation holds deny even otherwise-expired artifacts.
 * Legacy absent flags retain their previous behavior. Fail closed when a
 * present value is malformed. This is not a cross-service writer fence.
 */
export function assertVerificationPurgeRecordNotHeld(data: Record<string, unknown>): void {
  for (const field of ['photoPurgeHold', 'legalHold'] as const) {
    const value = data[field];
    if (value !== undefined && value !== false) {
      throw new Error('verification_photo_record_hold_or_invalid');
    }
  }
}

function assertStillEligibleForPurge(
  data: Record<string, unknown> | undefined, artifact: VerificationArtifactRecord, now: number,
): void {
  if (data) assertVerificationPurgeRecordNotHeld(data);
  const status = data ? readConsistentVerificationDecision(data) : 'pending';
  const due = normalizeTimestamp(data?.fotoLoeschenAb);
  if (!data || data.uid !== artifact.uid || data.storagePath !== artifact.storagePath
    || status !== artifact.status || status === 'pending'
    || normalizeTimestamp(data.decidedAt) !== artifact.decidedAt
    || data.photoPurged === true || due === null || due > now
    || !isVerificationArtifactExpired(artifact.decidedAt, now)) {
    throw new Error('verification_photo_eligibility_changed');
  }
}

/**
 * P0 #202 deployment safety interlock. A signed scheduler request is not itself
 * release authorization. Retain a default-deny switch until the all-writer
 * Firestore/GCS fencing protocol is independently verified and approved.
 */
export function isVerificationPhotoPurgeEnabled(
  configured: string | undefined,
): boolean {
  return configured === 'true';
}

/**
 * Destructive retention jobs must select a reviewed bucket by its exact name.
 * GCS's implicit default bucket is not a reliable identity boundary.
 * This checks the name shape only; IAM, provenance and legal holds require
 * independent staging evidence before enabling photo deletion.
 */
export function validatedVerificationPurgeBucketName(value: string | undefined): string | null {
  if (!value || value !== value.trim()
      || value.length < 3 || value.length > 222
      || !/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(value)
      || value.includes('..') || value.includes('.-') || value.includes('-.')) {
    return null;
  }
  return value;
}

export function complianceSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function validComplianceRequest(body: Buffer, timestampHeader: string | undefined, signatureHeader: string | undefined, secret: string, now = Date.now()): boolean {
  if (secret.length < 32 || !timestampHeader || !/^\d{10,16}$/.test(timestampHeader) || !signatureHeader || !/^[a-f0-9]{64}$/.test(signatureHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now)
    || Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS) return false;
  const expected = complianceSignature(`${timestampHeader}.${body.toString('utf8')}`, secret);
  const supplied = Buffer.from(signatureHeader, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return supplied.length === expectedBytes.length && timingSafeEqual(supplied, expectedBytes);
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const result = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(result) ? result : null;
  }
  if (typeof value === 'string') {
    const result = Date.parse(value);
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function readOptionalPurgeHoldFlag(
  data: Record<string, unknown> | undefined,
  field: string,
): boolean {
  const value = data?.[field];
  if (value === undefined || value === false) return false;
  if (value === true) return true;
  throw new Error('verification_photo_hold_flag_invalid');
}

function assertActivePurgeLease(state: Record<string, unknown> | undefined, leaseId: string): void {
  const expiresAt = normalizeTimestamp(state?.leaseUntil);
  if (state?.leaseId !== leaseId || expiresAt === null || expiresAt <= Date.now()) {
    throw new Error('verification_purge_lease_expired_or_lost');
  }
}

export function createVerificationStoragePurgeRouter(deps: {
  getDb: () => Firestore;
  getBucket?: () => { name: string; file: (path: string) => VerificationStorageFile };
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), async (req, res) => {
    // Never authenticate an invented fallback body: HMAC must cover the exact
    // received bytes. Wrong media types are intentionally not parsed by raw().
    if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);
    const body = req.body;
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);
    // Before Firestore lease acquisition and before touching any GCS object.
    if (!isVerificationPhotoPurgeEnabled(process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED)) {
      return res.status(503).json({ code: 'verification_storage_purge_disabled' });
    }
    // When a test-injected bucket is absent, never call getDb() or Storage
    // unless a separately reviewed, explicit bucket name was provided.
    const purgeBucketName = deps.getBucket
      ? null : validatedVerificationPurgeBucketName(process.env.FIREBASE_STORAGE_BUCKET);
    if (!deps.getBucket && !purgeBucketName) {
      return res.status(503).json({ code: 'verification_storage_purge_bucket_unconfigured' });
    }
    // P0: Authoritative Firestore decisions and GCS deletion are not atomic.
    // A late legal hold / moderation revocation after the final Firestore
    // check can still race with the GCS delete. Do NOT permit the production
    // route to be activated by environment variables alone.
    //
    // The production server only injects getDb, never getBucket. The latter
    // is reserved for deterministic local emulator tests. Do not add a
    // production getBucket injector until all writers share a reviewed,
    // transactionally fenced protocol and adversarial staging tests pass.
    if (process.env.NODE_ENV === 'production' || !deps.getBucket) {
      return res.status(503).json({ code: 'verification_storage_purge_p0_fencing_unverified' });
    }

    const db = deps.getDb();
    const now = Date.now();
    const checkpointRef = db.collection('system').doc('verification_photo_purge_scan_v1');
    const leaseId = randomUUID();
    try {
      // One scanner owns the cursor at a time. A crashed process expires its
      // lease, whereas a committed page can safely be replayed idempotently.
      const ownership = await db.runTransaction(async tx => {
        const snapshot = await tx.get(checkpointRef);
        const state = snapshot.data();
        const leaseUntil = normalizeTimestamp(state?.leaseUntil);
        if (state?.leaseId && leaseUntil === null) throw new Error('verification_purge_lease_invalid');
        if (leaseUntil !== null && leaseUntil > now) return { busy: true as const, cursor: null };
        const cursor = readPurgeCursor(state?.cursor ?? null);
        tx.set(checkpointRef, {
          leaseId, leaseUntil: new Date(now + LEASE_MS), lastStartedAt: new Date(now),
        }, { merge: true });
        return { busy: false as const, cursor };
      });
      if (ownership.busy) {
        return res.status(503).json({ code: 'verification_storage_purge_busy' });
      }

      let result: Awaited<ReturnType<typeof scanPurgePages>> | null = null;
      let scanFailed = false;
      try {
        result = await scanPurgePages({
          initial: ownership.cursor, pageSize: MAX_BATCH, maxPages: MAX_PAGES,
          deadline: () => Date.now() - now >= MAX_SCAN_MS,
          fetch: async (after, size) => {
            let query = db.collection('verification_events')
              .where('fotoLoeschenAb', '<=', new Date(now))
              .orderBy('fotoLoeschenAb')
              .orderBy(FieldPath.documentId());
            if (after) query = query.startAfter(new Timestamp(after.seconds, after.nanos), after.id);
            const snapshot = await query.limit(size).get();
            return snapshot.docs.map(doc => {
              const due = doc.get('fotoLoeschenAb');
              const cursor = readPurgeCursor({
                seconds: due?.seconds, nanos: due?.nanoseconds, id: doc.id,
              });
              if (!cursor) throw new Error('verification_purge_due_invalid');
              return { cursor, value: doc };
            });
          },
          handle: async docs => {
          const artifacts: VerificationArtifactRecord[] = docs.flatMap(doc => {
            const data = doc.data();
            const uid = typeof data.uid === 'string' ? data.uid : '';
            const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
            const decidedAt = normalizeTimestamp(data.decidedAt);
            // One inconsistent record must fail closed without blocking other
            // independently eligible records in the bounded page.
            let status: VerificationArtifactRecord['status'];
            try {
              status = readConsistentVerificationDecision(data);
            } catch (error) {
              if (error instanceof Error && error.message === 'verification_photo_decision_conflict') {
                return []; // Counted as failed below, never sent to Storage.
              }
              throw error; // Unknown validation failures still abort the scan.
            }
            if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) return [];
            return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
          });

            // Invalid due records and pending decisions must not be silently
            // declared purged; record aggregate failure and revisit on wrap.
            const invalid = docs.length - artifacts.length;
            if (!artifacts.length) return { purged: 0, skipped: 0, failed: docs.length };
          const bucket = deps.getBucket?.() ?? getStorage().bucket(purgeBucketName!);
          const proofs = new Map<string, PurgeProof>();
          const summary = await executeVerificationRetentionBatch(
            artifacts,
            async (path, artifact) => {
              const ref = db.collection('verification_events').doc(artifact.challengeId);
              const file = bucket.file(path);
              let storageMetadata: { generation: string | number; metageneration: string | number };
              try {
                storageMetadata = await inspectVerificationStorageMetadata(file);
              } catch (error) {
                if (!isStorageNotFound(error)) throw error;
                // 404 is evidence of present absence, NOT proof this worker
                // deleted an object. Reconcile only a previously persisted,
                // generation-bound intent for the identical decision/path.
                const prior = await db.runTransaction(async tx => {
                  const [lease, record] = await Promise.all([
                    tx.get(checkpointRef), tx.get(ref),
                  ]);
                  assertActivePurgeLease(lease.data(), leaseId);
                  assertStillEligibleForPurge(record.data(), artifact, now);
                  const intent = readMatchingPurgeIntent(record.data()?.photoPurgeIntent, artifact);
                  if (!intent) throw new Error('verification_purge_reconciliation_requires_intent');
                  return intent;
                });
                proofs.set(artifact.challengeId, {
                  generation: prior.generation, method: 'absence_reconciled',
                });
                return;
              }

              const bucketName = typeof bucket.name === 'string' ? bucket.name.trim() : '';
              if (!bucketName) throw new Error('verification_purge_bucket_identity_missing');

              // Revalidate the record and lease before creating a durable
              // deletion fence. The existing record holds remain fail-closed.
              const recordHolds = await db.runTransaction(async tx => {
                const [lease, record] = await Promise.all([
                  tx.get(checkpointRef), tx.get(ref),
                ]);
                assertActivePurgeLease(lease.data(), leaseId);
                const recordData = record.data();
                assertStillEligibleForPurge(recordData, artifact, Date.now());

                const holds = {
                  legalHoldActive: readOptionalPurgeHoldFlag(recordData, 'legalHoldActive')
                    || readOptionalPurgeHoldFlag(recordData, 'legalHold'),
                  moderationHoldActive: readOptionalPurgeHoldFlag(recordData, 'moderationHoldActive')
                    || readOptionalPurgeHoldFlag(recordData, 'photoPurgeHold'),
                  accountErasureActive: readOptionalPurgeHoldFlag(recordData, 'accountErasureActive'),
                };
                tx.update(checkpointRef, {
                  leaseUntil: new Date(Date.now() + LEASE_MS),
                });
                return holds;
              });

              const workerActor = 'verification-photo-purge-worker';
              const cas = await prepareVerificationDeleteCas(db, {
                uid: artifact.uid,
                challengeId: artifact.challengeId,
                bucket: bucketName,
                storagePath: path,
                observedGeneration: storageMetadata.generation,
                observedMetageneration: storageMetadata.metageneration,
                legalHoldActive: recordHolds.legalHoldActive,
                moderationHoldActive: recordHolds.moderationHoldActive,
                accountErasureActive: recordHolds.accountErasureActive,
                createdBy: workerActor,
                actor: workerActor,
                reservationOwner: leaseId,
              });

              if (!cas.readyForGcs) {
                // This callback is processed by purgeSingleVerificationArtifact's
                // per-item catch. Throwing prevents the DB updater from falsely
                // acknowledging deletion and lets the batch continue to the next item.
                logSafeFailure('verification_purge_item_skipped');
                throw new Error('verification_purge_cas_not_ready');
              }

              // Preserve the last lease and moderation checks immediately
              // before the GCS request, then verify the current fence token.
              await db.runTransaction(async tx => {
                const [lease, record] = await Promise.all([
                  tx.get(checkpointRef), tx.get(ref),
                ]);
                assertActivePurgeLease(lease.data(), leaseId);
                assertStillEligibleForPurge(record.data(), artifact, Date.now());
                const latestHolds = {
                  legalHoldActive: readOptionalPurgeHoldFlag(record.data(), 'legalHoldActive')
                    || readOptionalPurgeHoldFlag(record.data(), 'legalHold'),
                  moderationHoldActive: readOptionalPurgeHoldFlag(record.data(), 'moderationHoldActive')
                    || readOptionalPurgeHoldFlag(record.data(), 'photoPurgeHold'),
                  accountErasureActive: readOptionalPurgeHoldFlag(record.data(), 'accountErasureActive'),
                };
                if (latestHolds.legalHoldActive || latestHolds.moderationHoldActive
                  || latestHolds.accountErasureActive) {
                  throw new Error('verification_purge_record_hold_active');
                }
                tx.update(checkpointRef, {
                  leaseUntil: new Date(Date.now() + LEASE_MS),
                });
              });

              await verifyVerificationDeletionReservation(
                db,
                cas.objectKey,
                cas.reservationToken,
                cas.generation,
              );

              // Generation + metageneration are the GCS-side compare-and-swap.
              try {
                await file.delete({
                  ifGenerationMatch: cas.generation,
                  ifMetagenerationMatch: cas.metageneration,
                });
              } catch (error) {
                // 404 and 412 are item-level reconciliation/precondition
                // outcomes. The retention engine catches this item failure and
                // continues its bounded batch without invoking the DB updater.
                if (isStorageNotFound(error) || isStoragePreconditionFailed(error)) {
                  logSafeFailure('verification_purge_item_delete_failed');
                } else {
                  logSafeFailure('verification_purge_item_delete_failed');
                }
                throw new Error('verification_purge_gcs_delete_failed');
              }

              // A receipt is written only after GCS acknowledges the conditional delete.
              try {
                await writeVerificationDeletionReceipt(
                  db,
                  cas.attempt.attemptId,
                  cas.generation,
                  workerActor,
                );
              } catch {
                logSafeFailure('verification_purge_item_receipt_failed');
                throw new Error('verification_purge_receipt_write_failed');
              }

              proofs.set(artifact.challengeId, {
                generation: cas.generation,
                method: 'delete_acknowledged',
                attemptId: cas.attempt.attemptId,
                objectKey: cas.objectKey,
              });
            },
            async (uid, challengeId, auditData) => {
              const expected = artifacts.find(a => a.challengeId === challengeId && a.uid === uid);
              const proof = proofs.get(challengeId);
              if (!expected || !proof) {
                throw new Error('verification_photo_audit_proof_missing');
              }
              // If the file reappeared after the original 404, do NOT record
              // observed absence. This is a second observation, not a claim of
              // cross-system atomicity; Storage write fencing remains required.
              if (proof.method === 'absence_reconciled') {
                await confirmVerificationStorageAbsence(bucket.file(expected.storagePath));
              }
              const ref = db.collection('verification_events').doc(challengeId);
              await db.runTransaction(async tx => {
                const [lease, current] = await Promise.all([
                  tx.get(checkpointRef), tx.get(ref),
                ]);
                assertActivePurgeLease(lease.data(), leaseId);
                assertStillEligibleForPurge(current.data(), expected, Date.now());
                if (proof.method === 'absence_reconciled') {
                  const intent = readMatchingPurgeIntent(current.data()?.photoPurgeIntent, expected);
                  if (!intent || intent.generation !== proof.generation) {
                    throw new Error('verification_photo_audit_intent_mismatch');
                  }
                } else {
                  if (!proof.attemptId || !proof.objectKey) {
                    throw new Error('verification_photo_audit_receipt_reference_missing');
                  }
                  const attemptRef = db.collection(VERIFICATION_DELETION_ATTEMPT_COLLECTION)
                    .doc(proof.attemptId);
                  const fenceRef = db.collection(VERIFICATION_DELETION_FENCE_COLLECTION)
                    .doc(proof.objectKey);
                  const [attemptSnapshot, fenceSnapshot] = await Promise.all([
                    tx.get(attemptRef),
                    tx.get(fenceRef),
                  ]);
                  const attemptData = attemptSnapshot.data();
                  const fenceData = fenceSnapshot.data();
                  if (!attemptSnapshot.exists || !fenceSnapshot.exists
                    || attemptData?.attemptId !== proof.attemptId
                    || attemptData?.objectKey !== proof.objectKey
                    || attemptData?.status !== 'succeeded'
                    || attemptData?.generation !== proof.generation
                    || fenceData?.objectKey !== proof.objectKey
                    || fenceData?.state !== 'deleted'
                    || fenceData?.deletedGeneration !== proof.generation) {
                    throw new Error('verification_photo_audit_receipt_mismatch');
                  }
                }
                const evidenceDigest = createHash('sha256')
                  .update([
                    auditData.auditDigest,
                    proof.method,
                    proof.generation,
                    proof.attemptId ?? 'legacy-absence',
                    proof.objectKey ?? 'legacy-intent',
                  ].join(':'))
                  .digest('hex');
                tx.update(ref, {
                  ...auditData,
                  photoPurgeProof: {
                    method: proof.method,
                    generation: proof.generation,
                    ...(proof.attemptId ? { attemptId: proof.attemptId } : {}),
                    evidenceDigest,
                    verifiedAt: new Date(),
                  },
                });
              });
            },
            now,
          );


            const pendingOrFailed = summary.results.filter(item =>
              item.reason === 'error' || item.reason === 'pending_decision').length;
            return {
              purged: summary.purgedCount,
              skipped: summary.results.filter(item =>
                item.reason === 'already_purged' || item.reason === 'not_expired').length,
              failed: invalid + pendingOrFailed,
            };
          },
          checkpoint: async cursor => {
            await db.runTransaction(async tx => {
              const snapshot = await tx.get(checkpointRef);
              assertActivePurgeLease(snapshot.data(), leaseId);
              tx.update(checkpointRef, {
                cursor, lastCheckpointAt: new Date(),
                leaseUntil: new Date(Date.now() + LEASE_MS),
              });
            });
          },
        });
      } catch {
        scanFailed = true;
      }
      // Never acknowledge an incomplete scan until the lease is safely
      // released. On a process crash the expiring lease permits recovery.
      try {
        await db.runTransaction(async tx => {
          const snapshot = await tx.get(checkpointRef);
          if (snapshot.data()?.leaseId !== leaseId) throw new Error('verification_purge_lease_lost');
          tx.update(checkpointRef, { leaseId: null, leaseUntil: null });
        });
      } catch {
        scanFailed = true;
      }
      if (scanFailed || !result) throw new Error('verification_purge_incomplete');
      // A bounded backlog and retryable errors must not report a full PASS.
      // The scheduled caller will retry; the durable cursor prevents
      // repeatedly processing the first due rows.
      const incomplete = result.failed > 0 || result.hasMore;
      return res.status(incomplete ? 503 : 200).json({
        ok: !incomplete, processed: result.scanned, purgedCount: result.purged,
        skippedCount: result.skipped, failedCount: result.failed,
        hasMore: result.hasMore, pages: result.pages,
      });
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
