import express, { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 100;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

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
    try {
      const snapshot = await db.collection('verification_events')
        .where('fotoLoeschenAb', '<=', new Date(now))
        .limit(MAX_BATCH)
        .get();
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
      return res.json({ ok: true, ...summary });
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
