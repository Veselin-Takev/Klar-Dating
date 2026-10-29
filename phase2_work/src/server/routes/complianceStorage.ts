import express, { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';

const MAX_BATCH = 100;
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
        return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
      });

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
      const failedCount = summary.results.filter(result => result.reason === 'error').length;
      // The scheduler must retry partial failures; do not expose user IDs,
      // Storage paths or internal exception text in the HTTP response.
      const response = {
        ok: failedCount === 0,
        processed: summary.processed,
        purgedCount: summary.purgedCount,
        skippedCount: summary.skippedCount,
        failedCount,
      };
      return res.status(failedCount ? 503 : 200).json(response);
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
