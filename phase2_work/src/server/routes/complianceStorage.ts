import express, { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { executeVerificationRetentionBatch, type VerificationArtifactRecord } from '../platform/storageRetentionEngine';
import { assertCurrentVerificationPurgeCandidate, verifiedDeletionGeneration } from '../platform/verificationPurgeBoundary';

const MAX_BATCH = 100;
// Bounded read-only preflight. If the entire due set cannot be enumerated,
// refuse a misleading success; durable continuation remains a release blocker.
const MAX_SCAN_PAGES = 3;
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
  getBucket?: () => { file: (path: string) => {
    getMetadata: () => Promise<[Record<string, unknown>, ...unknown[]]>;
    delete: (options: { ifGenerationMatch: string }) => Promise<unknown>;
  } };
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('{}');
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);

    const db = deps.getDb();
    const now = Date.now();
    try {
      const dueQuery = db.collection('verification_events')
        .where('fotoLoeschenAb', '<=', new Date(now))
        .orderBy('fotoLoeschenAb');
      const dueDocs: QueryDocumentSnapshot[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      let complete = false;
      // All-or-nothing preflight: avoid a perpetually repeated first page and
      // never report 200 when due records beyond the scanned bound may exist.
      for (let page = 0; page < MAX_SCAN_PAGES; page++) {
        const query = cursor ? dueQuery.startAfter(cursor).limit(MAX_BATCH) : dueQuery.limit(MAX_BATCH);
        const snapshot = await query.get();
        dueDocs.push(...snapshot.docs);
        if (snapshot.docs.length < MAX_BATCH) { complete = true; break; }
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }
      if (!complete && cursor) {
        const next = await dueQuery.startAfter(cursor).limit(1).get();
        complete = next.empty || next.docs.length === 0;
      }
      if (!complete) {
        return res.status(503).json({
          ok: false, code: 'verification_storage_purge_scan_incomplete',
          scannedCount: dueDocs.length,
        });
      }
      const artifacts: VerificationArtifactRecord[] = dueDocs.flatMap(doc => {
        const data = doc.data();
        const uid = typeof data.uid === 'string' ? data.uid : '';
        const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
        const decidedAt = normalizeTimestamp(data.decidedAt);
        const statusRaw = data.entscheidung ?? data.status;
        const status = statusRaw === 'bestaetigt' || statusRaw === 'approved' ? 'approved' : statusRaw === 'abgelehnt' || statusRaw === 'rejected' ? 'rejected' : 'pending';
        if (!uid || !doc.id || !storagePath.startsWith(`verification/${uid}/`) || !decidedAt) return [];
        return [{ uid, challengeId: doc.id, status, decidedAt, storagePath, photoPurged: data.photoPurged === true, photoPurgedAt: normalizeTimestamp(data.photoPurgedAt) ?? undefined }];
      });

      // Entire due-page must be internally consistent *before* any GCS delete.
      // Otherwise an invalid later row could be discovered only after earlier
      // photos were irreversibly deleted, leaving a partial batch and no receipt.
      const malformedCount = dueDocs.length - artifacts.length;
      const usedPaths = new Set<string>();
      let invalidStateCount = 0;
      let duplicatePathCount = 0;
      if (malformedCount === 0) {
        for (let i = 0; i < artifacts.length; i++) {
          const artifact = artifacts[i];
          if (usedPaths.has(artifact.storagePath)) duplicatePathCount++;
          usedPaths.add(artifact.storagePath);
          if (!artifact.photoPurged) {
            try {
              assertCurrentVerificationPurgeCandidate(dueDocs[i].data(), artifact, now);
            } catch {
              invalidStateCount++;
            }
          }
        }
      }
      if (malformedCount > 0 || invalidStateCount > 0 || duplicatePathCount > 0) {
        return res.status(503).json({
          ok: false, code: 'verification_storage_purge_preflight_failed',
          scannedCount: dueDocs.length,
          malformedCount, invalidStateCount, duplicatePathCount,
        });
      }
      const bucket = deps.getBucket?.() ?? getStorage().bucket();
      const summary = await executeVerificationRetentionBatch(
        artifacts,
        async (path, artifact) => {
          // Re-read the authoritative decision before any destructive GCS operation.
          const current = await db.collection('verification_events').doc(artifact.challengeId).get();
          assertCurrentVerificationPurgeCandidate(current.data(), artifact, now);
          const file = bucket.file(path);
          const [metadata] = await file.getMetadata();
          const generation = verifiedDeletionGeneration(metadata, now);
          // A replaced object must be preserved; a 404 is not a verified purge receipt.
          await file.delete({ ifGenerationMatch: generation });
        },
        async (uid, challengeId, auditData) => {
          const ref = db.collection('verification_events').doc(challengeId);
          await db.runTransaction(async tx => {
            const current = await tx.get(ref);
            const original = artifacts.find(item => item.challengeId === challengeId && item.uid === uid);
            if (!current.exists || !original) throw new Error('verification_purge_receipt_candidate_missing');
            assertCurrentVerificationPurgeCandidate(current.data(), original, now);
            tx.update(ref, auditData);
          });
        },
        now,
      );
      // A scheduled caller checks only HTTP status. Never acknowledge a partial
      // failure as success or echo GCS errors, user IDs or photo paths.
      const failedCount = summary.results.filter(result => result.reason === 'error').length;
      const safeSummary = {
        processed: summary.processed,
        purgedCount: summary.purgedCount,
        skippedCount: summary.skippedCount,
        failedCount,
        malformedCount,
      };
      if (failedCount > 0 || malformedCount > 0 ||
          summary.results.length !== summary.processed ||
          summary.purgedCount + summary.skippedCount !== summary.processed) {
        return res.status(503).json({ ok: false, code: 'verification_storage_purge_incomplete', ...safeSummary });
      }
      return res.json({ ok: true, ...safeSummary });
    } catch {
      return res.status(503).json({ code: 'verification_storage_purge_unavailable' });
    }
  });
  return router;
}
