import express, { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

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

/**
 * VES-5 P0 containment: valid authentication MUST NOT authorize a physical
 * verification-photo deletion while the cross-service Firestore/GCS fencing
 * protocol (including *all* writers and the account-erasure path) is unproven.
 * This denial is deliberately unconditional, even in emulators. Do not re-enable
 * by an environment variable, feature flag, or injected Firebase dependency.
 */
export function createVerificationStoragePurgeRouter(_deps: {
  getDb: () => Firestore;
  getBucket?: () => { file: (path: string) => { delete: (options?: unknown) => Promise<unknown> } };
}): Router {
  const router = Router();
  router.post('/purge-verification-storage', express.raw({ inflate: false, type: 'application/json', limit: '2kb' }), (req, res) => {
    res.set('Cache-Control', 'no-store');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('{}');
    if (!validComplianceRequest(body, req.get('X-Klar-Compliance-Timestamp'), req.get('X-Klar-Compliance-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) {
      return res.sendStatus(401);
    }
    return res.status(503).json({ code: 'verification_storage_purge_p0_fencing_unverified' });
  });
  return router;
}
