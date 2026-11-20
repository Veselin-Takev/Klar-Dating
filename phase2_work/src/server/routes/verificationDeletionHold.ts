import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { currentUserId, requireRole } from '../authorization';
import { logSafeFailure } from '../safeErrorLog';
import {
  beginVerificationDeletionHold,
  confirmVerificationDeletionHold,
  readVerificationDeletionFence,
  ensureVerificationDeletionFenceForUploadedObject,
  verificationDeletionObjectKey,
  type VerificationDeletionFence,
  type VerificationDeletionHoldField,
} from '../platform/verificationDeletionFence';

type StorageVersion = string | number;

interface VerificationHoldMetadata {
  generation: StorageVersion;
  metageneration: StorageVersion;
  temporaryHold?: unknown;
}

interface VerificationHoldFile {
  getMetadata(): Promise<[unknown, ...unknown[]]>;
  setMetadata: (
    metadata: { temporaryHold: true },
    options: {
      ifGenerationMatch: StorageVersion;
      ifMetagenerationMatch: StorageVersion;
    },
  ) => Promise<unknown>;
}

interface VerificationHoldBucket {
  name: string;
  file(path: string): VerificationHoldFile;
}

export interface VerificationDeletionHoldRouterDeps {
  getDb: () => Firestore;
  /** Omitted bucket name resolves only to the configured application bucket. */
  getBucket: (bucketName?: string) => VerificationHoldBucket;
}

const HOLD_FIELDS = new Set<VerificationDeletionHoldField>([
  'legalHoldActive',
  'moderationHoldActive',
  'accountErasureActive',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStorageVersion(value: unknown): value is StorageVersion {
  return (typeof value === 'string' || typeof value === 'number')
    && /^[1-9][0-9]*$/.test(String(value))
    && (typeof value !== 'number' || Number.isSafeInteger(value));
}

function readMetadata(value: unknown): VerificationHoldMetadata {
  if (!isRecord(value)
    || !isStorageVersion(value.generation)
    || !isStorageVersion(value.metageneration)
    || (value.temporaryHold !== undefined
      && typeof value.temporaryHold !== 'boolean')) {
    throw new Error('verification_deletion_hold_storage_metadata_invalid');
  }
  return {
    generation: value.generation,
    metageneration: value.metageneration,
    temporaryHold: value.temporaryHold,
  };
}

function statusForError(error: unknown): number {
  const code = isRecord(error) ? error.code : undefined;
  const message = error instanceof Error ? error.message : '';
  if (code === 412 || code === '412'
    || code === 404 || code === '404'
    || message === 'verification_deletion_hold_pending_conflict'
    || message === 'verification_deletion_hold_pending_mismatch'
    || message === 'verification_deletion_already_deleted'
    || message === 'verification_deletion_generation_changed'
    || message === 'verification_deletion_metageneration_changed') return 409;
  if (message === 'verification_deletion_fence_missing') return 404;
  return 503;
}

function rolesForHoldField(field: VerificationDeletionHoldField): Parameters<typeof requireRole> {
  if (field === 'legalHoldActive') return ['trust_safety', 'admin', 'super_admin'];
  if (field === 'moderationHoldActive') return ['moderator', 'trust_safety', 'admin', 'super_admin'];
  // Account erasure state is written by the account-erasure workflow, not by
  // this manually callable administrator endpoint.
  return [];
}

function authorizeHoldField(
  req: Request,
  res: Response,
  field: VerificationDeletionHoldField,
): boolean {
  const roles = rolesForHoldField(field);
  if (roles.length === 0) {
    res.status(403).json({ code: 'verification_deletion_hold_field_internal_only' });
    return false;
  }
  let allowed = false;
  requireRole(...roles)(req, res, () => {
    allowed = true;
  });
  return allowed;
}

export function createVerificationDeletionHoldRouter(
  deps: VerificationDeletionHoldRouterDeps,
): ReturnType<typeof Router> {
  const router = Router();

  router.post('/verification-deletion/hold', async (req, res) => {
    const actor = currentUserId(req);
    if (!actor) return res.status(401).json({ code: 'unauthorized' });

    if (!isRecord(req.body)) {
      return res.status(400).json({ code: 'verification_deletion_hold_payload_invalid' });
    }

    const bodyKeys = Object.keys(req.body);
    if (bodyKeys.some(key => !['objectKey', 'uid', 'challengeId', 'storagePath', 'holdField', 'actor', 'requestId'].includes(key))) {
      return res.status(400).json({ code: 'verification_deletion_hold_payload_invalid' });
    }

    const {
      objectKey: suppliedObjectKey,
      uid: targetUid,
      challengeId,
      storagePath,
      holdField,
      actor: suppliedActor,
      requestId: bodyRequestId,
    } = req.body;
    const headerRequestId = req.get('Idempotency-Key');
    const requestId = bodyRequestId ?? headerRequestId;

    const hasObjectKey = typeof suppliedObjectKey === 'string' && /^[a-f0-9]{64}$/.test(suppliedObjectKey);
    const hasIdentity = typeof targetUid === 'string' && !!targetUid.trim()
      && typeof challengeId === 'string' && !!challengeId.trim()
      && typeof storagePath === 'string' && !!storagePath.trim();
    const hasPartialIdentity = targetUid !== undefined || challengeId !== undefined || storagePath !== undefined;
    if ((suppliedObjectKey !== undefined && !hasObjectKey)
      || (!hasObjectKey && !hasIdentity)
      || (hasPartialIdentity && !hasIdentity)
      || (typeof holdField !== 'string' || !HOLD_FIELDS.has(holdField as VerificationDeletionHoldField))
      || typeof requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(requestId)
      || (bodyRequestId !== undefined && headerRequestId !== undefined
        && bodyRequestId !== headerRequestId)
      || (suppliedActor !== undefined && suppliedActor !== actor)) {
      return res.status(400).json({ code: 'verification_deletion_hold_payload_invalid' });
    }

    const selectedField = holdField as VerificationDeletionHoldField;
    if (!authorizeHoldField(req, res, selectedField)) return;

    try {
      const db = deps.getDb();
      let objectKey = hasObjectKey ? suppliedObjectKey as string : '';
      let before: VerificationDeletionFence | undefined;
      let bucket: VerificationHoldBucket;
      let file: VerificationHoldFile;

      if (hasObjectKey) {
        try {
          before = await readVerificationDeletionFence(db, objectKey);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'verification_deletion_fence_missing' || !hasIdentity) {
            throw error;
          }
        }
      }

      if (!before) {
        if (!hasIdentity) return res.status(404).json({ code: 'verification_deletion_fence_missing' });
        bucket = deps.getBucket();
        if (!bucket || typeof bucket.name !== 'string' || !bucket.name) {
          logSafeFailure('verification_deletion_hold_failure');
          return res.status(503).json({ code: 'verification_deletion_hold_storage_unavailable' });
        }
        file = bucket.file(storagePath as string);
        const [rawMetadata] = await file.getMetadata();
        const initialMetadata = readMetadata(rawMetadata);
        const derivedObjectKey = verificationDeletionObjectKey({
          uid: targetUid as string,
          bucket: bucket.name,
          storagePath: storagePath as string,
          observedGeneration: initialMetadata.generation,
        });
        if (hasObjectKey && objectKey !== derivedObjectKey) {
          return res.status(409).json({ code: 'verification_deletion_fence_identity_mismatch' });
        }
        objectKey = derivedObjectKey;
        before = await ensureVerificationDeletionFenceForUploadedObject(db, {
          uid: targetUid as string,
          challengeId: challengeId as string,
          bucket: bucket.name,
          storagePath: storagePath as string,
          observedGeneration: initialMetadata.generation,
          observedMetageneration: initialMetadata.metageneration,
          createdBy: actor,
        });
      } else {
        if (hasIdentity && (before.uid !== targetUid
          || before.challengeId !== challengeId
          || before.storagePath !== storagePath)) {
          return res.status(409).json({ code: 'verification_deletion_fence_identity_mismatch' });
        }
        bucket = deps.getBucket(before.bucket);
        file = bucket.file(before.storagePath);
      }

      if (before.observedMetageneration === null) {
        return res.status(409).json({ code: 'verification_deletion_metageneration_missing' });
      }
      if (!bucket || bucket.name !== before.bucket) {
        logSafeFailure('verification_deletion_hold_failure');
        return res.status(503).json({ code: 'verification_deletion_hold_storage_unavailable' });
      }

      // This transaction invalidates any outstanding deletion reservation
      // before the external GCS barrier is requested.
      const pending = await beginVerificationDeletionHold(db, {
        objectKey,
        holdField: selectedField,
        actor,
        requestId,
      });
      if (pending.state !== 'hold_pending'
        || pending.pendingHoldField !== selectedField
        || pending.holdRequestId !== requestId) {
        return res.status(409).json({ code: 'verification_deletion_hold_pending_mismatch' });
      }

      try {
        const [rawMetadata] = await file.getMetadata();
        const metadata = readMetadata(rawMetadata);
        if (String(metadata.generation) !== before.observedGeneration) {
          return res.status(409).json({ code: 'verification_deletion_generation_changed' });
        }

        // A previously committed GCS temporary hold is already an adequate
        // object-level barrier. This lets retries finish Firestore confirmation
        // after a prior GCS success / Firestore failure.
        if (metadata.temporaryHold !== true) {
          if (metadata.temporaryHold !== undefined && metadata.temporaryHold !== false) {
            return res.status(409).json({ code: 'verification_deletion_hold_metadata_invalid' });
          }
          if (String(metadata.metageneration) !== before.observedMetageneration) {
            return res.status(409).json({ code: 'verification_deletion_metageneration_changed' });
          }

          await file.setMetadata(
            { temporaryHold: true },
            {
              ifGenerationMatch: before.observedGeneration,
              ifMetagenerationMatch: before.observedMetageneration,
            },
          );

          const [verifiedValue] = await file.getMetadata();
          const verified = readMetadata(verifiedValue);
          if (String(verified.generation) !== before.observedGeneration
            || verified.temporaryHold !== true) {
            throw new Error('verification_deletion_hold_gcs_barrier_unverified');
          }
        }

        // Firestore is confirmed only after GCS proves the object-level hold.
        const held = await confirmVerificationDeletionHold(db, {
          objectKey,
          holdField: selectedField,
          actor,
          requestId,
        });
        if (held.state !== 'held' || held[selectedField] !== true) {
          return res.status(503).json({ code: 'verification_deletion_hold_confirmation_unverified' });
        }

        return res.status(200).json({
          ok: true,
          objectKey,
          holdField: selectedField,
          state: 'held',
          holdVersion: held.holdVersion,
        });
      } catch (error) {
        logSafeFailure('verification_deletion_hold_failure');
        const status = statusForError(error);
        if (status === 409) {
          return res.status(409).json({ code: 'verification_deletion_hold_conflict' });
        }
        return res.status(503).json({ code: 'verification_deletion_hold_failed' });
      }
    } catch (error) {
      logSafeFailure('verification_deletion_hold_failure');
      const status = statusForError(error);
      return res.status(status).json({
        code: status === 404
          ? 'verification_deletion_fence_not_found'
          : status === 409
            ? 'verification_deletion_hold_conflict'
            : 'verification_deletion_hold_failed',
      });
    }
  });

  return router;
}
