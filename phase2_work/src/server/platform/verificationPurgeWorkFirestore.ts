import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import {
  claimPurgeWork, markDeletionIntent, quarantinePurgeWork, releaseUndeletedWork,
  type PurgeQuarantineReason, type PurgeWorkState,
} from './verificationPurgeWorkState';

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

/**
 * Only pre-deletion commands are deliberately exposed. These commands DO NOT
 * authorize a GCS delete. Receipt observation/completion is withheld until an
 * independently reviewed, authenticated GCS provenance and audit protocol exists.
 *
 * This opt-in prototype is not wired into any live route or Scheduler.
 */
export type PurgeWorkCommand =
  | { kind: 'claim'; token: string; now: number; leaseMs: number }
  | { kind: 'release_undeleted'; token: string; epoch: number; now: number; retryAfter: number }
  | { kind: 'prepare_delete_intent'; token: string; epoch: number; now: number; generation: string }
  | { kind: 'quarantine'; reason: PurgeQuarantineReason; now: number; token?: string; epoch?: number };

const allowedCommandFields: Record<PurgeWorkCommand['kind'], ReadonlySet<string>> = {
  claim: new Set(['kind','token','now','leaseMs']),
  release_undeleted: new Set(['kind','token','epoch','now','retryAfter']),
  prepare_delete_intent: new Set(['kind','token','epoch','now','generation']),
  quarantine: new Set(['kind','reason','now','token','epoch']),
};

function assertSupportedCommand(command: PurgeWorkCommand): void {
  if (command === null || typeof command !== 'object' || Array.isArray(command)) {
    throw new Error('purge_work_unsupported_command');
  }
  const fields = Object.prototype.hasOwnProperty.call(allowedCommandFields, command.kind)
    ? allowedCommandFields[command.kind] : undefined;
  if (!fields || Object.keys(command).some(key => !fields.has(key))) {
    throw new Error('purge_work_unsupported_command');
  }
}

function executePureCommand(state: PurgeWorkState, command: PurgeWorkCommand): PurgeWorkState {
  switch (command.kind) {
    case 'claim':
      return claimPurgeWork(state, command.token, command.now, command.leaseMs);
    case 'release_undeleted':
      return releaseUndeletedWork(state, command.token, command.epoch, command.now, command.retryAfter);
    case 'prepare_delete_intent':
      return markDeletionIntent(state, command.token, command.epoch, command.now, command.generation);
    case 'quarantine':
      return quarantinePurgeWork(state, command.reason, command.now, command.token, command.epoch);
    default:
      throw new Error('purge_work_unsupported_command');
  }
}

/**
 * Transactional command dispatcher. No arbitrary callback is accepted at the
 * public adapter boundary; the transaction callback is created internally and
 * has no external side effects. Cloud writes MUST be reviewed separately.
 */
export async function executePurgeWorkCommand(
  db: Pick<Firestore, 'runTransaction'>,
  ref: DocumentReference,
  command: PurgeWorkCommand,
): Promise<PurgeWorkState> {
  if (!ref || ref.parent.path !== 'verification_purge_jobs' ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(ref.id)) {
    throw new Error('purge_work_invalid_document_reference');
  }
  assertSupportedCommand(command);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('purge_work_missing_document');
    const data = snap.data();
    if (!data || data.schemaVersion !== 1 || data.key !== ref.id ||
        !Number.isSafeInteger(data.revision) || data.revision < 0) {
      throw new Error('purge_work_invalid_stored_state');
    }
    const current = data as PurgeWorkState;
    const next = executePureCommand(current, command);
    if (!next || next.schemaVersion !== 1 || next.key !== current.key ||
        next.revision !== current.revision + 1 ||
        !validFencedTransition(current, next)) {
      throw new Error('purge_work_transition_invariant');
    }
    tx.update(ref, next);
    return next;
  });
}
