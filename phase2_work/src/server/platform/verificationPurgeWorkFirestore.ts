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
        !['ready', 'leased', 'delete_intent', 'receipt_pending', 'complete', 'quarantined'].includes(next.status)) {
      throw new Error('purge_work_transition_invariant');
    }
    tx.update(ref, next);
    return next;
  });
}
