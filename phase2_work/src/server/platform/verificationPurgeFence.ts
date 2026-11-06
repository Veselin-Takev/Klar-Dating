/**
 * VES-5 — reference state machine for an ALL-WRITER Firestore/GCS purge fence.
 *
 * NOT production-wired. Production purge remains source-locked. The full
 * protocol needs transactional storage in Firestore, exhaustive writer
 * adoption, Cloud Storage IAM/hold evidence and an independent security
 * review before a destructive operation could use it.
 *
 * A last-minute read of Firestore is NOT a fence: if a decision or legal hold
 * can commit after the read, GCS ifGenerationMatch does not protect it.
 *
 * This contract instead reserves a persistent, monotonic "deleting" state
 * that every decision/hold writer MUST reject while in force. No automatic
 * expiry: a blocked GCS request may still execute after a Firestore lease
 * expires. Recovery requires reconciling the in-flight GCS operation.
 */

export type VerificationPurgeDecision = 'approved' | 'rejected' | 'pending';

export type VerificationPurgeOpenFence = Readonly<{
  phase: 'open';
  epoch: number;
  decision: VerificationPurgeDecision;
  legalHold: boolean;
}>;

export type VerificationPurgeDeletingFence = Readonly<{
  phase: 'deleting';
  epoch: number;
  decision: 'approved' | 'rejected';
  legalHold: false;
  permitId: string;
  generation: string;
}>;

export type VerificationPurgeDeletedFence = Readonly<{
  phase: 'deleted';
  epoch: number;
  decision: 'approved' | 'rejected';
  permitId: string;
  generation: string;
  receiptDigest: string;
}>;

export type VerificationPurgeFence =
  | VerificationPurgeOpenFence
  | VerificationPurgeDeletingFence
  | VerificationPurgeDeletedFence;

function assertEpoch(epoch: number): void {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= Number.MAX_SAFE_INTEGER) {
    throw new Error('verification_purge_invalid_fence_epoch');
  }
}

function nextEpoch(epoch: number): number {
  assertEpoch(epoch);
  return epoch + 1;
}

function assertPermitId(permitId: string): void {
  if (typeof permitId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(permitId)) {
    throw new Error('verification_purge_invalid_fence_permit');
  }
}

function assertGeneration(generation: string): void {
  if (typeof generation !== 'string' || !/^[1-9][0-9]*$/.test(generation)) {
    throw new Error('verification_purge_invalid_fence_generation');
  }
}

export function initialVerificationPurgeFence(
  decision: VerificationPurgeDecision,
  legalHold = false,
): VerificationPurgeOpenFence {
  if (decision !== 'pending' && decision !== 'approved' && decision !== 'rejected') {
    throw new Error('verification_purge_invalid_decision');
  }
  if (typeof legalHold !== 'boolean') throw new Error('verification_purge_invalid_hold');
  return { phase: 'open', epoch: 0, decision, legalHold };
}

export function startVerificationPurgeFence(
  state: VerificationPurgeFence,
  permitId: string,
  generation: string,
): VerificationPurgeDeletingFence {
  if (state.phase !== 'open') throw new Error('verification_purge_fence_already_claimed');
  assertEpoch(state.epoch);
  assertPermitId(permitId);
  assertGeneration(generation);
  if (state.legalHold) throw new Error('verification_purge_fence_legal_hold');
  if (state.decision === 'pending') throw new Error('verification_purge_fence_decision_pending');
  return {
    phase: 'deleting', epoch: nextEpoch(state.epoch),
    decision: state.decision, legalHold: false, permitId, generation,
  };
}

/**
 * Called by ALL participating moderation/decision writers in the SAME
 * Firestore transaction that changes the actual decision. A separate
 * preflight query does not establish isolation.
 *
 * Rejecting a revocation while deletion is in-flight means the revocation
 * was NOT accepted. Real policy must coordinate legal holds on GCS before
 * promising to the requester that a hold took effect.
 */
export function changeVerificationPurgeDecision(
  state: VerificationPurgeFence,
  decision: VerificationPurgeDecision,
): VerificationPurgeOpenFence {
  if (state.phase === 'deleting') throw new Error('verification_purge_fence_busy');
  if (state.phase === 'deleted') throw new Error('verification_purge_fence_already_deleted');
  if (decision !== 'pending' && decision !== 'approved' && decision !== 'rejected') {
    throw new Error('verification_purge_invalid_decision');
  }
  return { ...state, epoch: nextEpoch(state.epoch), decision };
}

export function placeVerificationPurgeLegalHold(
  state: VerificationPurgeFence,
): VerificationPurgeOpenFence {
  if (state.phase === 'deleting') {
    // Must not commit a legal hold in Firestore while allowing a previously
    // authorized GCS delete to continue. Requires an external GCS interlock.
    throw new Error('verification_purge_hold_requires_storage_interlock');
  }
  if (state.phase === 'deleted') throw new Error('verification_purge_fence_already_deleted');
  return { ...state, epoch: nextEpoch(state.epoch), legalHold: true };
}

export function releaseVerificationPurgeLegalHold(
  state: VerificationPurgeFence,
): VerificationPurgeOpenFence {
  if (state.phase !== 'open' || !state.legalHold) {
    throw new Error('verification_purge_hold_not_active');
  }
  return { ...state, epoch: nextEpoch(state.epoch), legalHold: false };
}

export function assertVerificationPurgeDeletePermit(
  state: VerificationPurgeFence, permitId: string, generation: string,
): asserts state is VerificationPurgeDeletingFence {
  if (state.phase !== 'deleting' || state.permitId !== permitId
      || state.generation !== generation) {
    throw new Error('verification_purge_fence_token_mismatch');
  }
}

/** A new permit must never reuse a stale epoch/token; the worker also needs
 * GCS generation CAS. Never turn a crashed "deleting" fence back to "open"
 * just because a lease timer has elapsed.
 */
export function completeVerificationPurgeFence(
  state: VerificationPurgeFence,
  permitId: string,
  generation: string,
  receiptDigest: string,
): VerificationPurgeDeletedFence {
  assertVerificationPurgeDeletePermit(state, permitId, generation);
  if (typeof receiptDigest !== 'string' || !/^[a-f0-9]{64}$/.test(receiptDigest)) {
    throw new Error('verification_purge_invalid_receipt_digest');
  }
  return {
    phase: 'deleted', epoch: nextEpoch(state.epoch),
    decision: state.decision, permitId, generation, receiptDigest,
  };
}
