import express, { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';
import { deleteVerificationPhotoIfUnchanged, matchesActiveRetentionDecision, retentionTimestamp, type VerificationPhotoBucket } from '../platform/verificationPhotoDelete';

const MAX_BATCH = 100;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

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

export function createVerificationStoragePurgeRouter(deps: {
  getDb: () => Firestore;
  getBucket?: () => VerificationPhotoBucket;
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('{}');
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
        const decidedAt = retentionTimestamp(data.decidedAt);
        const statusRaw = data.entscheidung ?? data.status;
        const status = statusRaw === 'bestaetigt' || statusRaw === 'approved' ? 'approved' : statusRaw === 'abgelehnt' || statusRaw === 'rejected' ? 'rejected' : 'pending';
        if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) return [];
        return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: retentionTimestamp(data.photoPurgedAt) ?? undefined }];
      });

      // The vendor bucket offers the same runtime methods; this narrow adapter
      // intentionally sends an exact decimal generation string to GCS.
      const bucket = (deps.getBucket?.() ?? getStorage().bucket()) as unknown as VerificationPhotoBucket;
      const summary = await executeVerificationRetentionBatch(
        artifacts,
        async (path, artifact) => {
          const ref = db.collection('verification_events').doc(artifact.challengeId);
          const fresh = await ref.get();
          if (!fresh.exists || !matchesActiveRetentionDecision(fresh.data(), artifact, now)) {
            throw new Error('verification_photo_decision_changed');
          }
          await deleteVerificationPhotoIfUnchanged(bucket, path, now);
        },
        async (uid, challengeId, auditData, artifact) => {
          const ref = db.collection('verification_events').doc(challengeId);
          await db.runTransaction(async tx => {
            const current = await tx.get(ref);
            if (uid !== artifact.uid || !current.exists ||
                !matchesActiveRetentionDecision(current.data(), artifact, now)) {
              // Never claim success for a missing, changed or newly held record.
              throw new Error('verification_photo_audit_conflict');
            }
            tx.update(ref, auditData);
          });
        },
        now,
      );
      // Per-artifact failures must make the scheduler retry/reconcile. Do not
      // return PII-bearing object paths or upstream GCS errors in the response.
      if (summary.results.some(result => result.reason === 'error')) {
        return res.status(503).json({
          code: 'verification_storage_purge_incomplete',
          processed: summary.processed,
          purgedCount: summary.purgedCount,
          skippedCount: summary.skippedCount,
        });
      }
      return res.json({
        ok: true, processed: summary.processed,
        purgedCount: summary.purgedCount, skippedCount: summary.skippedCount,
      });
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
