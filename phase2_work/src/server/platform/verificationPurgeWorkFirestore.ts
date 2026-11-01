import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { PurgeWorkState } from './verificationPurgeWorkState';

/**
 * P0 #202 — Opt-in repository adapter; NOT connected to any live job.
 *
 * The transaction's callback must be a PURE state transformation. Firestore
 * may retry it. Absolutely no GCS delete, network side effect or audit commit
 * belongs inside this transaction. The caller must separately reconcile source
 * ownership, moderation decision, holds, object generation, and audit receipt.
 */
/**
 * The adapter itself is a second line of defence: a caller-supplied callback
 * must not jump from ready directly to complete, erase a delete intent, or
 * re-enable destructive retry after the write-ahead fence is committed.
 */
const allowedTransitions: Record<PurgeWorkState['status'], ReadonlySet<PurgeWorkState['status']>> = {
  ready: new Set(['leased', 'quarantined']),
  leased: new Set(['leased', 'ready', 'delete_intent', 'quarantined']),
  delete_intent: new Set(['receipt_pending']),
  receipt_pending: new Set(['receipt_pending', 'complete']),
  complete: new Set(),
  quarantined: new Set(),
};
const opaqueToken = (value: unknown): boolean =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
const safeTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function sameLease(a: PurgeWorkState['lease'], b: PurgeWorkState['lease']): boolean {
  return a === undefined ? b === undefined
    : b !== undefined && a.token === b.token &&
      a.epoch === b.epoch && a.expiresAt === b.expiresAt;
}
function sameObserved(a: PurgeWorkState['observed'], b: PurgeWorkState['observed']): boolean {
  return a === undefined ? b === undefined
    : b !== undefined && a.generation === b.generation &&
      a.observedAt === b.observedAt;
}
function validLease(lease: PurgeWorkState['lease']): boolean {
  return !!lease && opaqueToken(lease.token) &&
    Number.isSafeInteger(lease.epoch) && lease.epoch > 0 && safeTime(lease.expiresAt);
}
const quarantineReasons = new Set([
  'invalid_source', 'ambiguous_ownership', 'legal_hold',
  'conflicting_decision', 'unverifiable_generation', 'manual_review',
]);
function validFencedTransition(current: PurgeWorkState, next: PurgeWorkState): boolean {
  if (!allowedTransitions[current.status]?.has(next.status)) return false;
  if (!Number.isSafeInteger(current.attempt) || current.attempt < 0 ||
      !Number.isSafeInteger(next.attempt) || next.attempt < 0 ||
      !safeTime(current.availableAt) || !safeTime(next.availableAt)) return false;
  // The generation identity cannot be rewritten by a caller-supplied transform.
  if (current.intent && (next.intent?.generation !== current.intent.generation ||
      next.intent.preparedAt !== current.intent.preparedAt ||
      next.intent.leaseEpoch !== current.intent.leaseEpoch)) return false;
  if (current.observed && !sameObserved(current.observed, next.observed)) return false;
  if (next.status !== 'complete' && (next.completedAt !== undefined ||
      next.receiptDigest !== undefined)) return false;
  if (next.status !== 'quarantined' && next.quarantineReason !== undefined) return false;

  if (next.status === 'leased' && (current.status === 'ready' || current.status === 'leased')) {
    if (!validLease(next.lease) || !next.lease ||
        next.attempt !== current.attempt + 1 ||
        next.availableAt !== current.availableAt ||
        next.lease.epoch !== (current.lease?.epoch ?? 0) + 1 ||
        next.lease.expiresAt <= current.availableAt ||
        next.intent !== undefined || next.observed !== undefined) return false;
    return true;
  }
  if (next.status === 'ready' && current.status === 'leased') {
    return sameLease(current.lease, next.lease) &&
      next.attempt === current.attempt && next.availableAt > current.availableAt &&
      next.intent === undefined && next.observed === undefined;
  }
  if (next.status === 'delete_intent' && current.status === 'leased') {
    return sameLease(current.lease, next.lease) && validLease(next.lease) &&
      next.attempt === current.attempt && next.availableAt === current.availableAt &&
      next.observed === undefined && next.intent !== undefined &&
      next.intent.leaseEpoch === next.lease?.epoch &&
      /^[1-9][0-9]*$/.test(next.intent.generation) &&
      safeTime(next.intent.preparedAt) && next.intent.preparedAt < (next.lease?.expiresAt ?? 0);
  }
  if (next.status === 'receipt_pending' && current.status === 'delete_intent') {
    return sameLease(current.lease, next.lease) && validLease(next.lease) &&
      next.attempt === current.attempt && next.availableAt === current.availableAt &&
      !!current.intent && !!next.observed &&
      current.intent.generation === next.observed.generation &&
      safeTime(next.observed.observedAt) &&
      next.observed.observedAt >= current.intent.preparedAt &&
      next.observed.observedAt < (next.lease?.expiresAt ?? 0);
  }
  if (next.status === 'receipt_pending' && current.status === 'receipt_pending') {
    return validLease(current.lease) && validLease(next.lease) &&
      next.lease!.epoch === current.lease!.epoch + 1 &&
      next.lease!.expiresAt > current.lease!.expiresAt &&
      next.attempt === current.attempt && next.availableAt === current.availableAt &&
      !!current.observed && !!next.observed &&
      current.intent?.generation === next.observed.generation &&
      sameObserved(current.observed, next.observed) && !!next.intent;
  }
  if (next.status === 'complete' && current.status === 'receipt_pending') {
    return sameLease(current.lease, next.lease) && validLease(next.lease) &&
      next.attempt === current.attempt && next.availableAt === current.availableAt &&
      !!current.intent && !!current.observed &&
      sameObserved(current.observed, next.observed) &&
      /^[a-f0-9]{64}$/.test(next.receiptDigest ?? '') &&
      safeTime(next.completedAt) &&
      next.completedAt >= current.observed.observedAt &&
      next.completedAt < (next.lease?.expiresAt ?? 0);
  }
  if (next.status === 'quarantined' &&
      (current.status === 'ready' || current.status === 'leased')) {
    return sameLease(current.lease, next.lease) &&
      next.attempt === current.attempt && next.availableAt === current.availableAt &&
      next.intent === undefined && next.observed === undefined &&
      quarantineReasons.has(next.quarantineReason ?? '');
  }
  return false;
}

export async function transitionPurgeWorkInTransaction(
  db: Pick<Firestore, 'runTransaction'>,
  ref: DocumentReference,
  transform: (current: PurgeWorkState) => PurgeWorkState,
): Promise<PurgeWorkState> {
  if (!ref || ref.parent.path !== 'verification_purge_jobs' ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(ref.id)) {
    throw new Error('purge_work_invalid_document_reference');
  }
  if (typeof transform !== 'function') throw new Error('purge_work_missing_transition');
  return db.runTransaction(async tx => {
    // Reads before writes. SDK can retry on conflicting concurrent updates.
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('purge_work_missing_document');
    const data = snap.data();
    if (!data || data.schemaVersion !== 1 || data.key !== ref.id ||
        !Number.isSafeInteger(data.revision) || data.revision < 0) {
      throw new Error('purge_work_invalid_stored_state');
    }
    // The only permitted writes come from a pure transition. A secure producer
    // and generation-fenced consumer must be reviewed and deployed separately.
    const current = data as PurgeWorkState;
    const next = transform(current);
    if (!next || next.schemaVersion !== 1 || next.key !== current.key ||
        next.revision !== current.revision + 1 ||
        !validFencedTransition(current, next)) {
      throw new Error('purge_work_transition_invariant');
    }
    tx.update(ref, next);
    return next;
  });
}
