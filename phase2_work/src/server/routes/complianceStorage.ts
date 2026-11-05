import express, { Router } from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readPurgeCursor, scanPurgePages, type PurgeFailure, type PurgeCursor } from '../platform/verificationPurgeScan';
import {
  verificationPurgeIncompleteEvent, verificationPurgeP0BlockedEvent,
  verificationPurgeUnavailableEvent,
} from '../platform/verificationPurgeTelemetry';
import { executeVerificationRetentionBatch, isVerificationArtifactExpired, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 25;
const MAX_PAGES = 4;
const LEASE_MS = 5 * 60_000;
const MAX_SCAN_MS = 100_000;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
// Firestore TTL must be activated for this dedicated collection before production.
const SIGNED_NONCE_RETENTION_MS = 15 * 60_000;

// P0 VES-5: Release authorization is NOT a mutable environment variable.
// No live photo purge may run before an independently reviewed cross-service
// all-writer fencing protocol replaces this code-level prohibition.
const VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false;

// The Google Cloud Storage generation is an opaque decimal identifier.
// Replacements must never be deleted using an unchecked or stale generation.
export type VerificationStorageFile = {
  getMetadata: () => Promise<[{ generation?: string | number; temporaryHold?: boolean | null; eventBasedHold?: boolean | null }, ...unknown[]]>;
  delete: (options: { ifGenerationMatch: string | number }) => Promise<unknown>;
};

export async function inspectVerificationStorageGeneration(file: VerificationStorageFile): Promise<string | number> {
  const [metadata] = await file.getMetadata();
  if (!metadata || metadata.temporaryHold === true || metadata.eventBasedHold === true) {
    throw new Error('verification_photo_metadata_or_hold_invalid');
  }
  const generation = metadata.generation;
  if ((typeof generation !== 'string' && typeof generation !== 'number')
    || !/^[1-9][0-9]*$/.test(String(generation))
    || (typeof generation === 'number' && !Number.isSafeInteger(generation))) {
    throw new Error('verification_photo_generation_missing');
  }
  return generation;
}

export async function deleteVerificationStorageFile(
  file: VerificationStorageFile, expectedGeneration?: string | number,
  beforeDelete?: () => Promise<void>,
): Promise<void> {
  const generation = await inspectVerificationStorageGeneration(file);
  if (expectedGeneration !== undefined && String(generation) !== String(expectedGeneration)) {
    throw new Error('verification_photo_generation_changed');
  }
  // Revalidate Firestore authorization after the last Storage metadata read.
  // A cross-service update after this callback still needs operational fencing.
  if (beforeDelete) await beforeDelete();
  await file.delete({ ifGenerationMatch: generation });
}

type PurgeIntent = {
  generation: string;
  storagePath: string;
  decidedAt: number;
  status: 'approved' | 'rejected';
};

type PurgeProof = { generation: string; method: 'delete_acknowledged' | 'absence_reconciled' };

function isStorageNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 404 || code === '404';
}

/**
 * A persisted intent proves that this worker attempted a deletion, not that a
 * missing object will remain absent. Confirm absence again immediately before
 * finalizing an absence-reconciled audit receipt.
 */
export async function confirmVerificationStorageAbsence(
  file: Pick<VerificationStorageFile, 'getMetadata'>,
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

function assertStillEligibleForPurge(
  data: Record<string, unknown> | undefined, artifact: VerificationArtifactRecord, now: number,
): void {
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
 * Temporary P0 live-release lock. Until all-writer fencing is verified and
 * independently approved, only isolated LOCAL emulator tests may reach the
 * destructive route. This blocks even a mistakenly enabled environment flag.
 *
 * This is defense in depth, NOT a resolution of the Firestore/GCS race.
 */
export function isVerificationPhotoPurgeRuntimeAllowed(
  // Runtime environment variables are optional even when their names are
  // statically known; absent values must be denied, not made type-required.
  environment: Record<string, string | undefined>,
): boolean {
  if (VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED) return true;
  const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}$/;
  const projects = [
    environment.GCLOUD_PROJECT, environment.GOOGLE_CLOUD_PROJECT,
    environment.FIREBASE_PROJECT_ID,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return environment.NODE_ENV === 'test'
    && projects.length > 0 // Empty identity cannot establish an isolated demo environment.
    && !environment.K_SERVICE && !environment.K_REVISION && !environment.FUNCTION_TARGET
    && loopback.test(environment.FIRESTORE_EMULATOR_HOST ?? '')
    && loopback.test(environment.FIREBASE_STORAGE_EMULATOR_HOST ?? '')
    && projects.every(project => project === 'demo-klar');
}

export function complianceSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function validComplianceRequest(
  body: Buffer, timestampHeader: string | undefined, nonceHeader: string | undefined,
  signatureHeader: string | undefined, secret: string, now = Date.now(),
): boolean {
  // The nonce is bound to the signature AND to a durable Firestore receipt.
  // Only lowercase UUIDv4 is accepted to prevent path injection and aliases.
  if (secret.length < 32 || !timestampHeader || !/^\d{10,16}$/.test(timestampHeader)
    || !nonceHeader || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonceHeader)
    || !signatureHeader || !/^[a-f0-9]{64}$/.test(signatureHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now)
    || Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS) return false;
  // Authenticate received bytes, not UTF-8 decoding: malformed sequences must not
  // canonicalize into the replacement character and share an HMAC with other bytes.
  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${nonceHeader}.`, 'utf8')
    .update(body)
    .digest('hex');
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

function assertActivePurgeLease(state: Record<string, unknown> | undefined, leaseId: string): void {
  const expiresAt = normalizeTimestamp(state?.leaseUntil);
  if (state?.leaseId !== leaseId || expiresAt === null || expiresAt <= Date.now()) {
    throw new Error('verification_purge_lease_expired_or_lost');
  }
}

export function createVerificationStoragePurgeRouter(deps: {
  getDb: () => Firestore;
  getBucket?: () => { file: (path: string) => VerificationStorageFile };
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), async (req, res) => {
    // Never authenticate an invented fallback body: HMAC must cover the exact
    // received bytes. Wrong media types are intentionally not parsed by raw().
    if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);
    const body = req.body;
    const nonce = req.get('X-Klar-Compliance-Nonce');
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), nonce, req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);
    // Before Firestore lease acquisition and before touching any GCS object.
    if (!isVerificationPhotoPurgeEnabled(process.env.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED)) {
      return res.status(503).json({ code: 'verification_storage_purge_disabled' });
    }
    // P0 fails closed even with valid HMAC and an enabled feature flag.
    // Must execute BEFORE the first Firestore lease or Storage operation.
    // Environment variables are operator-controlled and cannot alone prove
    // that SDKs point at emulators. The production router never injects a
    // test bucket; require this explicit source-code test seam as well.
    if (!isVerificationPhotoPurgeRuntimeAllowed(process.env)
      || typeof deps.getBucket !== 'function') {
      console.error(JSON.stringify(verificationPurgeP0BlockedEvent()));
      return res.status(503).json({ code: 'verification_storage_purge_p0_live_blocked' });
    }

    const db = deps.getDb();
    const now = Date.now();
    const checkpointRef = db.collection('system').doc('verification_photo_purge_scan_v1');
    // A valid signature alone is replayable. Record its signed nonce durably
    // in the same Firestore transaction that acquires/observes the scan lease.
    const nonceRef = db.collection('verification_photo_purge_nonces').doc(nonce!);
    const leaseId = randomUUID();
    try {
      // One scanner owns the cursor at a time. A crashed process expires its
      // lease, whereas a committed page can safely be replayed idempotently.
      const ownership = await db.runTransaction(async tx => {
        const [snapshot, usedNonce] = await Promise.all([
          tx.get(checkpointRef), tx.get(nonceRef),
        ]);
        if (usedNonce.exists) return { kind: 'replay' as const, cursor: null };
        const state = snapshot.data();
        const leaseUntil = normalizeTimestamp(state?.leaseUntil);
        if (state?.leaseId && leaseUntil === null) throw new Error('verification_purge_lease_invalid');
        const busy = leaseUntil !== null && leaseUntil > now;
        const cursor = busy ? null : readPurgeCursor(state?.cursor ?? null);
        // Consume even busy requests: a valid signed invocation is single-use,
        // including retries during another worker's active lease.
        tx.create(nonceRef, {
          purpose: 'verification_photo_purge',
          usedAt: Timestamp.fromMillis(now),
          expiresAt: Timestamp.fromMillis(now + SIGNED_NONCE_RETENTION_MS),
        });
        if (busy) return { kind: 'busy' as const, cursor: null };
        tx.set(checkpointRef, {
          leaseId, leaseUntil: new Date(now + LEASE_MS), lastStartedAt: new Date(now),
          // A complete clean pass may span multiple bounded invocations.
          // A new cycle begins only at the persisted null cursor.
          cycleHadFailures: cursor === null ? false : state?.cycleHadFailures === true,
        }, { merge: true });
        return { kind: 'owned' as const, cursor };
      });
      if (ownership.kind === 'replay') return res.sendStatus(401);
      if (ownership.kind === 'busy') {
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
          const failedReasons = new Map<string, PurgeFailure['reason']>();
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
                failedReasons.set(doc.id, 'decision_conflict');
                 return []; // Never sent to Storage; durable failure note follows.
              }
              throw error; // Unknown validation failures still abort the scan.
            }
            if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) {
              failedReasons.set(doc.id, 'invalid_record');
              return [];
            }
            return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
          });

            // Invalid due records and pending decisions must not be silently
            // declared purged; record aggregate failure and revisit on wrap.
            if (!artifacts.length) return {
              purged: 0, skipped: 0, failed: docs.length,
              failures: [...failedReasons].map(([id, reason]) => ({ id, reason })),
            };
          const bucket = deps.getBucket?.() ?? getStorage().bucket();
          const proofs = new Map<string, PurgeProof>();
          const summary = await executeVerificationRetentionBatch(
            artifacts,
            async (path, artifact) => {
              const ref = db.collection('verification_events').doc(artifact.challengeId);
              const file = bucket.file(path);
              let generation: string | number;
              try {
                generation = await inspectVerificationStorageGeneration(file);
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

              // Commit an immutable-in-place deletion intent BEFORE touching
              // Storage. A subsequent 404 can then be reconciled conservatively.
              await db.runTransaction(async tx => {
                const [lease, record] = await Promise.all([
                  tx.get(checkpointRef), tx.get(ref),
                ]);
                assertActivePurgeLease(lease.data(), leaseId);
                assertStillEligibleForPurge(record.data(), artifact, now);
                const existing = readMatchingPurgeIntent(record.data()?.photoPurgeIntent, artifact);
                if (existing && existing.generation !== String(generation)) {
                  throw new Error('verification_purge_intent_generation_changed');
                }
                if (!existing) {
                  tx.update(ref, { photoPurgeIntent: {
                    generation: String(generation), storagePath: path,
                    decidedAt: artifact.decidedAt, status: artifact.status,
                    preparedAt: new Date(),
                  } });
                }
              });
              // Repeat metadata/hold validation to reduce the read/delete
              // race; use exact generation precondition against replacement.
              await deleteVerificationStorageFile(file, generation, async () => {
                // A moderation change or expired lease between initial read
                // and the last Storage metadata check must block deletion.
                await db.runTransaction(async tx => {
                  const [lease, record] = await Promise.all([
                    tx.get(checkpointRef), tx.get(ref),
                  ]);
                  assertActivePurgeLease(lease.data(), leaseId);
                  assertStillEligibleForPurge(record.data(), artifact, Date.now());
                  const intent = readMatchingPurgeIntent(record.data()?.photoPurgeIntent, artifact);
                  if (!intent || intent.generation !== String(generation)) {
                    throw new Error('verification_purge_predelete_intent_mismatch');
                  }
                  // Refresh only while still the valid owner. A Storage API call
                  // can still outlive its lease and must fail audit if it does.
                  tx.update(checkpointRef, { leaseUntil: new Date(Date.now() + LEASE_MS) });
                });
              });
              proofs.set(artifact.challengeId, {
                generation: String(generation), method: 'delete_acknowledged',
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
                const intent = readMatchingPurgeIntent(current.data()?.photoPurgeIntent, expected);
                if (!intent || intent.generation !== proof.generation) {
                  throw new Error('verification_photo_audit_intent_mismatch');
                }
                const evidenceDigest = createHash('sha256')
                  .update([auditData.auditDigest, proof.method, proof.generation].join(':'))
                  .digest('hex');
                tx.update(ref, {
                  ...auditData,
                  photoPurgeProof: {
                    method: proof.method,
                    generation: proof.generation,
                    evidenceDigest,
                    verifiedAt: new Date(),
                  },
                });
              });
            },
            now,
          );


            for (const item of summary.results) {
              if (item.reason === 'error' || item.reason === 'pending_decision') {
                failedReasons.set(item.challengeId, item.reason === 'error'
                  ? 'processing_error' : 'pending_decision');
              }
            }
            return {
              purged: summary.purgedCount,
              skipped: summary.results.filter(item =>
                item.reason === 'already_purged' || item.reason === 'not_expired').length,
              failed: failedReasons.size,
              failures: [...failedReasons].map(([id, reason]) => ({ id, reason })),
            };
          },
          // A failure marker remains on the original verification_events
          // document, so Art.-17 account erasure covers it automatically.
          // Cursor advancement and all failure markers share ONE transaction.
          identifyItem: doc => doc.id,
          recordFailedPage: async (cursor: PurgeCursor | null, docs, failures) => {
            const ids = new Set(docs.map(doc => doc.id));
            if (failures.some(failure => !ids.has(failure.id))
              || new Set(failures.map(failure => failure.id)).size !== failures.length) {
              throw Error('verification_purge_failure_receipt_invalid');
            }
            await db.runTransaction(async tx => {
              const lease = await tx.get(checkpointRef);
              assertActivePurgeLease(lease.data(), leaseId);
              const codes = new Map(failures.map(failure => [failure.id, failure.reason]));
              for (const doc of docs) {
                const code = codes.get(doc.id);
                // Never record UID, Storage path, signed body or raw error text.
                tx.update(doc.ref, code
                  ? { photoPurgeFailure: { code, lastAttemptAt: Timestamp.fromMillis(now) } }
                  : { photoPurgeFailure: FieldValue.delete() });
              }
              tx.update(checkpointRef, {
                cursor, lastCheckpointAt: new Date(),
                leaseUntil: new Date(Date.now() + LEASE_MS),
                lastFailedAt: new Date(), lastFailedCount: failures.length,
                cycleHadFailures: true, hasUnresolvedFailures: true,
              });
            });
          },
          checkpoint: async (cursor, completed) => {
            await db.runTransaction(async tx => {
              const snapshot = await tx.get(checkpointRef);
              assertActivePurgeLease(snapshot.data(), leaseId);
              for (const doc of completed ?? []) {
                tx.update(doc.ref, { photoPurgeFailure: FieldValue.delete() });
              }
              tx.update(checkpointRef, {
                cursor, lastCheckpointAt: new Date(),
                leaseUntil: new Date(Date.now() + LEASE_MS),
                // The backlog latch clears only after reaching the end of an
                // entire cycle with no failed page. A page-level success alone
                // must never acknowledge previously journaled unresolved work.
                ...(cursor === null ? {
                  hasUnresolvedFailures: snapshot.data()?.cycleHadFailures === true,
                  cycleHadFailures: false,
                } : {}),
              });
            });
          },
        });
      } catch {
        scanFailed = true;
      }
      // Never acknowledge an incomplete scan until the lease is safely
      // released. On a process crash the expiring lease permits recovery.
      let unresolvedFailureBacklog = true;
      try {
        unresolvedFailureBacklog = await db.runTransaction(async tx => {
          const snapshot = await tx.get(checkpointRef);
          if (snapshot.data()?.leaseId !== leaseId) throw new Error('verification_purge_lease_lost');
          tx.update(checkpointRef, { leaseId: null, leaseUntil: null });
          return snapshot.data()?.hasUnresolvedFailures === true;
        });
      } catch {
        scanFailed = true;
      }
      if (scanFailed || !result) throw new Error('verification_purge_incomplete');
      // A clean *page* is not a clean *cycle*: never report success while any
      // earlier error in the bounded pass still awaits a full clean revisit.
      const incomplete = result.failed > 0 || result.hasMore || unresolvedFailureBacklog;
      if (incomplete) {
        console.warn(JSON.stringify(verificationPurgeIncompleteEvent(result, unresolvedFailureBacklog)));
      }
      return res.status(incomplete ? 503 : 200).json({
        ok: !incomplete, processed: result.scanned, purgedCount: result.purged,
        skippedCount: result.skipped, failedCount: result.failed,
        hasMore: result.hasMore, pages: result.pages,
        unresolvedFailureBacklog,
      });
    } catch {
      // No raw exception, user identifiers, object paths, signed data or tokens.
      console.error(JSON.stringify(verificationPurgeUnavailableEvent()));
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
