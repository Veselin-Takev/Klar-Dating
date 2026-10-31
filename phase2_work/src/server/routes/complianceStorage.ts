import express, { Router } from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readPurgeCursor, scanPurgePages } from '../platform/verificationPurgeScan';
import { executeVerificationRetentionBatch, isVerificationArtifactExpired, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 25;
const MAX_PAGES = 4;
const LEASE_MS = 5 * 60_000;
const MAX_SCAN_MS = 100_000;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

// The Google Cloud Storage generation is an opaque decimal identifier.
// Replacements must never be deleted using an unchecked or stale generation.
export type VerificationStorageFile = {
  getMetadata: () => Promise<[{
    generation?: string | number;
    temporaryHold?: boolean | null;
    eventBasedHold?: boolean | null;
    retentionExpirationTime?: string | null;
    retention?: { retainUntilTime?: string | null } | null;
  }, ...unknown[]]>;
  delete: (options: { ifGenerationMatch: string | number }) => Promise<unknown>;
};

// Runtime metadata may be malformed despite SDK typings: only explicit false
// or absent hold flags are safe. Strings such as "false" must never grant DELETE.
function isActiveOrMalformedHold(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false;
}

export async function inspectVerificationStorageGeneration(file: VerificationStorageFile): Promise<string | number> {
  const [metadata] = await file.getMetadata();
  if (!metadata || isActiveOrMalformedHold(metadata.temporaryHold)
      || isActiveOrMalformedHold(metadata.eventBasedHold)) {
    throw new Error('verification_photo_metadata_or_hold_invalid');
  }
  // An object-level retention object without a valid retain-until timestamp is
  // ambiguous. Deny rather than pretending the retention lock expired.
  if (metadata.retention != null &&
      (typeof metadata.retention !== 'object' || Array.isArray(metadata.retention) ||
       typeof metadata.retention.retainUntilTime !== 'string')) {
    throw new Error('verification_photo_retention_locked');
  }
  // GCS retention (including object-level retention) must never be bypassed
  // by the scheduler. Malformed or future retention timestamps fail closed.
  for (const value of [metadata.retentionExpirationTime, metadata.retention?.retainUntilTime]) {
    if (value != null) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('verification_photo_retention_locked');
      const until = Date.parse(value);
      if (!Number.isFinite(until) || until > Date.now()) {
        throw new Error('verification_photo_retention_locked');
      }
    }
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

export function assertStillEligibleForPurge(
  data: Record<string, unknown> | undefined, artifact: VerificationArtifactRecord, now: number,
): void {
  const state = data?.entscheidung ?? data?.status;
  const status = state === 'bestaetigt' || state === 'approved' ? 'approved'
    : state === 'abgelehnt' || state === 'rejected' ? 'rejected' : 'pending';
  const due = normalizeTimestamp(data?.fotoLoeschenAb);
  if (!data || data.uid !== artifact.uid || data.storagePath !== artifact.storagePath
    || status !== artifact.status || status === 'pending'
    || normalizeTimestamp(data.decidedAt) !== artifact.decidedAt
    || data.photoPurged === true
    || ('legalHold' in data && data.legalHold !== false)
    || ('retentionHold' in data && data.retentionHold !== false)
    || due === null || due > now
    || !isVerificationArtifactExpired(artifact.decidedAt, now)) {
    throw new Error('verification_photo_eligibility_changed');
  }
}

export function complianceSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function validComplianceRequest(body: Buffer, timestampHeader: string | undefined, signatureHeader: string | undefined, secret: string, now = Date.now()): boolean {
  if (secret.length < 32 || !timestampHeader || !/^\d{10,16}$/.test(timestampHeader) || !signatureHeader || !/^[a-f0-9]{64}$/.test(signatureHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS) return false;
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
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('{}');
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);

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
            const statusRaw = data.entscheidung ?? data.status;
            const status = statusRaw === 'bestaetigt' || statusRaw === 'approved' ? 'approved' : statusRaw === 'abgelehnt' || statusRaw === 'rejected' ? 'rejected' : 'pending';
            if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) return [];
            return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
          });

            // Invalid due records and pending decisions must not be silently
            // declared purged; record aggregate failure and revisit on wrap.
            const invalid = docs.length - artifacts.length;
            if (!artifacts.length) return { purged: 0, skipped: 0, failed: docs.length };
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
