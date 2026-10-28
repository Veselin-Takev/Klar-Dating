import express, { Router } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 100;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
const CURSOR_STATE_PATH = 'system/verification_photo_purge_cursor';
const WORKER_LEASE_MS = 10 * 60_000;

interface PurgeKeysetCursor { at: Timestamp; id: string }

/** Do not silently discard invalid persisted state or restart at first page. */
export function readVerificationPurgeCursor(data: Record<string, unknown>): PurgeKeysetCursor | null {
  const at = data.cursorAt;
  const id = data.cursorId;
  if ((at === null || at === undefined) && (id === null || id === undefined)) return null;
  if (typeof id !== 'string' || !id || id === '.' || id === '..' || id.includes('/') || Buffer.byteLength(id, 'utf8') > 1500
    || !at || typeof at !== 'object') throw new Error('INVALID_VERIFICATION_PURGE_CURSOR');
  const seconds = (at as { seconds?: unknown }).seconds;
  const nanoseconds = (at as { nanoseconds?: unknown }).nanoseconds;
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds < 0
    || typeof nanoseconds !== 'number' || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1_000_000_000)
    throw new Error('INVALID_VERIFICATION_PURGE_CURSOR');
  return { at: new Timestamp(seconds, nanoseconds), id };
}

/** Invalid/incomplete persisted lease state is not a free lock. */
export function readVerificationPurgeLease(data: Record<string, unknown>, now: number): boolean {
  const token = data.leaseToken;
  const until = data.leaseUntil;
  const emptyToken = token === null || token === undefined;
  const emptyUntil = until === null || until === undefined;
  if (emptyToken && emptyUntil) return false;
  const milliseconds = normalizeTimestamp(until);
  if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(token)
    || !Number.isSafeInteger(milliseconds) || milliseconds! <= 0 || emptyUntil) {
    throw new Error('INVALID_VERIFICATION_PURGE_LEASE');
  }
  return milliseconds! > now;
}

function expiryFromFirestore(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return Timestamp.fromDate(value);
  throw new Error('INVALID_VERIFICATION_EXPIRY_CURSOR');
}


export function complianceSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function validComplianceRequest(body: Buffer, timestampHeader: string | undefined, signatureHeader: string | undefined, secret: string, now = Date.now()): boolean {
  if (secret.length < 32 || !timestampHeader || !/^\d{10,16}$/.test(timestampHeader) || !signatureHeader || !/^[a-f0-9]{64}$/.test(signatureHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS) return false;
  // Use original bytes; decoding invalid UTF-8 must never change signed content.
  const expected = createHmac('sha256', secret).update(`${timestampHeader}.`, 'utf8').update(body).digest('hex');
  const supplied = Buffer.from(signatureHeader, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return supplied.length === expectedBytes.length && timingSafeEqual(supplied, expectedBytes);
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
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
  getBucket?: () => { file: (path: string) => { delete: (options?: unknown) => Promise<unknown> } };
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), async (req, res) => {
    // Reject requests if upstream middleware consumed the byte-exact body.
    if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);
    const body: Buffer = req.body;
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);

    const db = deps.getDb();
    const now = Date.now();
    const stateRef = db.doc(CURSOR_STATE_PATH);
    const leaseToken = randomUUID();
    let ownsLease = false;
    try {
      // One active worker at a time. The cursor lives in Firestore, not memory.
      const claim = await db.runTransaction(async tx => {
        const stateSnap = await tx.get(stateRef);
        const state = (stateSnap.data() ?? {}) as Record<string, unknown>;
        const cursor = readVerificationPurgeCursor(state);
        if (readVerificationPurgeLease(state, now)) return { busy: true as const };
        tx.set(stateRef, { leaseToken, leaseUntil: new Date(now + WORKER_LEASE_MS),
          lastLeaseAt: new Date(now) }, { merge: true });
        return { busy: false as const, cursor };
      });
      if (claim.busy) return res.status(202).json({ ok: false, busy: true });
      ownsLease = true;

      // Keyset pagination: strict expiry + __name__ order. Even a page full
      // of held/invalid records advances the persistent scanning position.
      let query = db.collection('verification_events')
        .where('fotoLoeschenAb', '<=', new Date(now))
        .orderBy('fotoLoeschenAb', 'asc')
        .orderBy(FieldPath.documentId(), 'asc');
      if (claim.cursor) query = query.startAfter(claim.cursor.at, claim.cursor.id);
      const snapshot = await query.limit(MAX_BATCH).get();
      const artifacts: VerificationArtifactRecord[] = snapshot.docs.flatMap(doc => {
        const data = doc.data();
        const uid = typeof data.uid === 'string' ? data.uid : '';
        const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
        const decidedAt = normalizeTimestamp(data.decidedAt);
        const statusRaw = data.entscheidung ?? data.status;
        const status = statusRaw === 'bestaetigt' || statusRaw === 'approved' ? 'approved' : statusRaw === 'abgelehnt' || statusRaw === 'rejected' ? 'rejected' : 'pending';
        if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) return [];
        return [{ uid, challengeId: doc.id, status, decidedAt, storagePath,
          storageGeneration: typeof data.storageGeneration === 'string' ? data.storageGeneration : undefined,
          photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
      });

      const bucket = deps.getBucket?.() ?? getStorage().bucket();
      const summary = await executeVerificationRetentionBatch(
        artifacts,
        async (path, generation, artifact) => {
          const snapshot = await db.collection('verification_events').doc(artifact.challengeId).get();
          const data = snapshot.data();
          const status = data?.entscheidung ?? data?.status;
          if (!snapshot.exists || data?.uid !== artifact.uid || data?.storagePath !== path
            || data?.storageGeneration !== generation || data?.photoPurged === true
            || !['bestaetigt', 'abgelehnt', 'approved', 'rejected'].includes(status)
            || data?.legalHold === true || data?.retentionHold === true || data?.photoPurgeHold === true
            || normalizeTimestamp(data?.decidedAt) !== artifact.decidedAt
            || (normalizeTimestamp(data?.fotoLoeschenAb) ?? Infinity) > now)
            throw new Error('VERIFICATION_PURGE_DECISION_CHANGED_OR_HELD');
          // 404 and 412 are not successful deletion proof. Never ignore either.
          await bucket.file(path).delete({ ifGenerationMatch: generation });
        },
        async (uid, challengeId, auditData) => {
          const ref = db.collection('verification_events').doc(challengeId);
          await db.runTransaction(async tx => {
            const current = await tx.get(ref);
            const data = current.data();
            const expected = artifacts.find(a => a.challengeId === challengeId);
            if (!current.exists || data?.uid !== uid || !expected || data?.storagePath !== expected.storagePath
              || data?.storageGeneration !== expected.storageGeneration || data?.photoPurged === true
              || data?.legalHold === true || data?.retentionHold === true || data?.photoPurgeHold === true)
              throw new Error('VERIFICATION_PURGE_AUDIT_CONFLICT');
            tx.update(ref, auditData);
          });
        },
        now,
      );
      // Persist checkpoint only after the page has been fully evaluated.
      // Reset at end-of-scan; on the next invocation held/failed events are
      // reconsidered from the beginning, including late-arriving documents.
      const last = snapshot.docs.at(-1);
      const next = last ? { at: expiryFromFirestore(last.get('fotoLoeschenAb')), id: last.id } : null;
      // Malformed document rows are errors too: preserve pagination liveness
      // without reporting a clean retention run when records were discarded.
      const errors = summary.results.filter(item => item.reason === 'error').length
        + (snapshot.docs.length - artifacts.length);
      await db.runTransaction(async tx => {
        const lease = await tx.get(stateRef);
        if (lease.data()?.leaseToken !== leaseToken) throw new Error('VERIFICATION_PURGE_LEASE_LOST');
        tx.set(stateRef, { cursorAt: next?.at ?? null, cursorId: next?.id ?? null,
          leaseToken: null, leaseUntil: null, lastBatchAt: new Date(now),
          lastScanned: snapshot.docs.length, lastErrors: errors, completedCycle: next === null },
          { merge: true });
      });
      ownsLease = false;
      // Errors are auditable and non-successful, but must not starve other
      // due documents; the checkpoint has already advanced.
      if (errors) return res.status(503).json({ ok: false, code: 'verification_storage_purge_partial_failure',
        scanned: snapshot.docs.length, errors, ...summary });
      return res.json({ ok: true, scanned: snapshot.docs.length, ...summary });
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    } finally {
      // A failed page leaves the previously persisted cursor intact. Release
      // only the lease still held by this worker; otherwise it expires.
      if (ownsLease) {
        try {
          await db.runTransaction(async tx => {
            const lease = await tx.get(stateRef);
            if (lease.data()?.leaseToken === leaseToken)
              tx.set(stateRef, { leaseToken: null, leaseUntil: null }, { merge: true });
          });
        } catch { /* Lease expiry is the fail-closed recovery mechanism. */ }
      }
    }
  });
  return router;
}
