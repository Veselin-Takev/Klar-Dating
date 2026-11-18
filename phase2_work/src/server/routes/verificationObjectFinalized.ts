import express, { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { logSafeFailure } from '../safeErrorLog';
import {
  validComplianceRequest,
  validatedVerificationPurgeBucketName,
} from './complianceStorage';
import {
  registerFinalizedVerificationObject,
  type FinalizedVerificationObject,
} from '../platform/verificationObjectRegistration';
import { VerificationDeletionFenceError } from '../platform/verificationDeletionFence';

export interface VerificationObjectFinalizedRouterDeps {
  getDb: () => Firestore;
  getBucketName: () => string | undefined;
}

/** Internal-only endpoint: raw-body HMAC is verified before parsing or Firestore access. */
export function createVerificationObjectFinalizedRouter(
  deps: VerificationObjectFinalizedRouterDeps,
): ReturnType<typeof Router> {
  const router = Router();
  router.post('/object-finalized', express.raw({
    inflate: false,
    type: 'application/json',
    limit: '16kb',
  }), async (req, res) => {
    if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);
    if (!validComplianceRequest(
      req.body,
      req.get('X-Klar-Compliance-Timestamp'),
      req.get('X-Klar-Compliance-Signature'),
      process.env.COMPLIANCE_JOB_SECRET ?? '',
    )) return res.sendStatus(401);

    const bucketName = validatedVerificationPurgeBucketName(deps.getBucketName());
    if (!bucketName) return res.status(503).json({ code: 'verification_object_bucket_unconfigured' });

    let object: FinalizedVerificationObject;
    try {
      const parsed: unknown = JSON.parse(req.body.toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return res.status(422).json({ code: 'verification_object_event_invalid' });
      }
      object = parsed as FinalizedVerificationObject;
    } catch {
      return res.status(422).json({ code: 'verification_object_event_invalid' });
    }

    try {
      const fence = await registerFinalizedVerificationObject(deps.getDb(), bucketName, object);
      return res.status(200).json({ ok: true, registered: fence !== null });
    } catch (error) {
      if (error instanceof VerificationDeletionFenceError) {
        const status = error.code === 'verification_deletion_fence_identity_mismatch' ? 409 : 422;
        return res.status(status).json({ code: 'verification_object_registration_rejected' });
      }
      logSafeFailure('verification_object_registration_failure');
      return res.status(503).json({ code: 'verification_object_registration_unavailable' });
    }
  });
  return router;
}
