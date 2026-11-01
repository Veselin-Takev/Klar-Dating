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
function validFencedTransition(current: PurgeWorkState, next: PurgeWorkState): boolean {
  if (!allowedTransitions[current.status]?.has(next.status)) return false;
  // Once an object-specific GCS generation is fenced, no adapter callback may
  // drop or change its immutable intent, including after a worker crash.
  if (current.intent && (next.intent?.generation !== current.intent.generation ||
      next.intent.preparedAt !== current.intent.preparedAt ||
      next.intent.leaseEpoch !== current.intent.leaseEpoch)) return false;
  if (next.status === 'delete_intent' &&
      (current.status !== 'leased' ||
       !next.lease || next.intent?.leaseEpoch !== next.lease.epoch ||
       !/^[1-9][0-9]*$/.test(next.intent?.generation ?? '') ||
       typeof next.intent?.preparedAt !== 'number' || !Number.isSafeInteger(next.intent.preparedAt))) return false;
  if (next.status === 'receipt_pending' &&
      (!next.intent || !next.observed || next.intent.generation !== next.observed.generation)) return false;
  if (next.status === 'complete' &&
      (current.status !== 'receipt_pending' || !current.observed || !current.intent ||
       !/^[a-f0-9]{64}$/.test(next.receiptDigest ?? '') ||
       typeof next.completedAt !== 'number' || !Number.isSafeInteger(next.completedAt))) return false;
  if (next.status === 'ready' && next.intent) return false;
  return true;
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
