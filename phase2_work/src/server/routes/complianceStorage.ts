import express, { Router } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readPurgeCursor, scanPurgePages } from '../platform/verificationPurgeScan';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 25;
const MAX_PAGES = 4;
const LEASE_MS = 5 * 60_000;
const MAX_SCAN_MS = 100_000;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

// The Google Cloud Storage generation is an opaque decimal identifier.
// Replacements must never be deleted using an unchecked or stale generation.
export type VerificationStorageFile = {
  getMetadata: () => Promise<[{ generation?: string | number; temporaryHold?: boolean | null; eventBasedHold?: boolean | null }, ...unknown[]]>;
  delete: (options: { ifGenerationMatch: string | number }) => Promise<unknown>;
};

export async function deleteVerificationStorageFile(file: VerificationStorageFile): Promise<void> {
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
  await file.delete({ ifGenerationMatch: generation });
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
          const summary = await executeVerificationRetentionBatch(
            artifacts,
            async path => {
              await deleteVerificationStorageFile(bucket.file(path));
            },
            async (uid, challengeId, auditData) => {
              const ref = db.collection('verification_events').doc(challengeId);
              await db.runTransaction(async tx => {
                const current = await tx.get(ref);
                const expected = artifacts.find(artifact => artifact.challengeId === challengeId && artifact.uid === uid);
                // A vanished or rebound event is NOT a successful audit receipt.
                if (!expected || !current.exists || current.data()?.uid !== uid
                  || current.data()?.storagePath !== expected.storagePath) {
                  throw new Error('verification_photo_audit_record_changed');
                }
                tx.update(ref, auditData);
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
              if (snapshot.data()?.leaseId !== leaseId) throw new Error('verification_purge_lease_lost');
              tx.update(checkpointRef, { cursor, lastCheckpointAt: new Date() });
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
