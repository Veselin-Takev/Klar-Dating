/**
 * VES-5: transaction-backed Firestore coordination primitives, review-only.
 *
 * These are NOT yet wired to the existing destructive purge, Admin SDK
 * account deletion, or external writer APIs. They must never be described
 * as cross-service atomicity or a production-ready GCS legal-hold interlock.
 *
 * A caller must use these operations as part of an independently authorized
 * workflow. The legacy purge remains source-locked and rejects any fence field.
 */
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import {
  changeVerificationPurgeDecision,
  initialVerificationPurgeFence,
  placeVerificationPurgeLegalHold,
  startVerificationPurgeFence,
  type VerificationPurgeDecision,
  type VerificationPurgeDeletingFence,
  type VerificationPurgeFence,
  type VerificationPurgeOpenFence,
} from './verificationPurgeFence';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GCS_GENERATION = /^[1-9][0-9]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validEpoch(epoch: unknown): epoch is number {
  return typeof epoch === 'number' && Number.isSafeInteger(epoch)
    && epoch >= 0 && epoch < Number.MAX_SAFE_INTEGER;
}

function validDecision(value: unknown): value is VerificationPurgeDecision {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

/** Missing, partial, malformed, or unrecognized state MUST NOT auto-migrate. */
export function parsePersistedVerificationPurgeFence(value: unknown): VerificationPurgeFence {
  if (!isRecord(value) || !validEpoch(value.epoch) || !validDecision(value.decision)) {
    throw new Error('verification_purge_fence_record_invalid');
  }
  if (value.phase === 'open' && typeof value.legalHold === 'boolean'
      && !('permitId' in value) && !('generation' in value) && !('receiptDigest' in value)) {
    return { phase: 'open', epoch: value.epoch, decision: value.decision, legalHold: value.legalHold };
  }
  if ((value.phase === 'deleting' || value.phase === 'deleted')
      && value.decision !== 'pending'
      && typeof value.permitId === 'string' && UUID_V4.test(value.permitId)
      && typeof value.generation === 'string' && GCS_GENERATION.test(value.generation)) {
    if (value.phase === 'deleting' && value.legalHold === false && !('receiptDigest' in value)) {
      return {
        phase: 'deleting', epoch: value.epoch, decision: value.decision,
        legalHold: false, permitId: value.permitId, generation: value.generation,
      };
    }
    if (value.phase === 'deleted' && !('legalHold' in value)
        && typeof value.receiptDigest === 'string' && /^[0-9a-f]{64}$/.test(value.receiptDigest)) {
      return {
        phase: 'deleted', epoch: value.epoch, decision: value.decision,
        permitId: value.permitId, generation: value.generation,
        receiptDigest: value.receiptDigest,
      };
    }
  }
  throw new Error('verification_purge_fence_record_invalid');
}

function decodeDecision(value: unknown): VerificationPurgeDecision | null {
  if (value === null || value === undefined) return null;
  if (value === 'bestaetigt' || value === 'approved') return 'approved';
  if (value === 'abgelehnt' || value === 'rejected') return 'rejected';
  if (value === 'in_pruefung' || value === 'pending') return 'pending';
  throw new Error('verification_purge_decision_not_canonical');
}

function inspectVerificationEvent(data: Record<string, unknown> | undefined): {
  fence: VerificationPurgeFence;
  decision: VerificationPurgeDecision;
} {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'photoPurgeFence')) {
    throw new Error('verification_purge_fence_not_initialized');
  }
  const fence = parsePersistedVerificationPurgeFence(data.photoPurgeFence);
  const canonical = decodeDecision(data.entscheidung);
  const legacy = decodeDecision(data.status);
  if (canonical && legacy && canonical !== legacy) {
    throw new Error('verification_purge_decision_conflict');
  }
  const decision = canonical ?? legacy;
  if (!decision || fence.decision !== decision) {
    // A writer bypassed the fence protocol or the record was corrupted.
    throw new Error('verification_purge_fence_decision_drift');
  }
  return { fence, decision };
}

function assertEventRef(ref: DocumentReference): void {
  if (ref.parent.id !== 'verification_events' || !ref.id) {
    throw new Error('verification_purge_fence_wrong_collection');
  }
}

/** Initial state is written when creating a new event, in its SAME transaction. */
export function initialVerificationEventFence(
  decision: VerificationPurgeDecision,
): VerificationPurgeOpenFence {
  return initialVerificationPurgeFence(decision);
}

/**
 * Reserve an exclusive permit by committing the 'deleting' state on the same
 * event document. Commit happens BEFORE any hypothetical GCS operation.
 * Another compliant writer must read this document within its own transaction
 * and fail when the phase is 'deleting'. This function never deletes a file.
 */
export async function reserveVerificationPurgeEvent(
  db: Firestore, ref: DocumentReference, permitId: string, generation: string,
): Promise<VerificationPurgeDeletingFence> {
  assertEventRef(ref);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const { fence } = inspectVerificationEvent(data);
    if (data?.photoPurged === true) throw new Error('verification_purge_already_completed');
    if (typeof data?.uid !== 'string' || !data.uid
      || typeof data.storagePath !== 'string'
      || !data.storagePath.startsWith('verification/' + data.uid + '/')) {
      throw new Error('verification_purge_fence_invalid_owner_path');
    }
    const next = startVerificationPurgeFence(fence, permitId, generation);
    tx.update(ref, { photoPurgeFence: next });
    return next;
  });
}

/** Same-document transaction: cannot ACK moderation change during deletion. */
export async function transactVerificationEventDecision(
  db: Firestore, ref: DocumentReference, decision: VerificationPurgeDecision,
): Promise<VerificationPurgeOpenFence> {
  assertEventRef(ref);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const { fence } = inspectVerificationEvent(snap.data());
    const next = changeVerificationPurgeDecision(fence, decision);
    tx.update(ref, {
      photoPurgeFence: next,
      entscheidung: decision === 'approved' ? 'bestaetigt'
        : decision === 'rejected' ? 'abgelehnt' : 'in_pruefung',
      status: decision,
    });
    return next;
  });
}

/** A hold must not be ACKed while the same record has an active GCS permit. */
export async function transactVerificationEventLegalHold(
  db: Firestore, ref: DocumentReference,
): Promise<VerificationPurgeOpenFence> {
  assertEventRef(ref);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const { fence } = inspectVerificationEvent(snap.data());
    const next = placeVerificationPurgeLegalHold(fence);
    tx.update(ref, { photoPurgeFence: next });
    return next;
  });
}
