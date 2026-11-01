/**
 * P0 #202 — Inert, pure retention work-state transitions.
 *
 * Not wired to any endpoint, Scheduler, Cloud Storage or database. An approved
 * adapter MUST commit each transition atomically in a Firestore transaction,
 * re-read authoritative decision/legal holds, and persist a durable receipt.
 *
 * No physical delete, external IO, or source identifiers occur in this module.
 */
export type PurgeWorkStatus = 'ready' | 'leased' | 'receipt_pending' | 'complete' | 'quarantined';
export type PurgeQuarantineReason =
  | 'invalid_source' | 'ambiguous_ownership' | 'legal_hold'
  | 'conflicting_decision' | 'unverifiable_generation' | 'manual_review';

export interface PurgeWorkState {
  schemaVersion: 1;
  /** HMAC-derived opaque queue ID. No UID, image path or raw challenge ID. */
  key: string;
  status: PurgeWorkStatus;
  revision: number;
  attempt: number;
  availableAt: number;
  /** Fencing token is generated outside a retried transaction. */
  lease?: { token: string; epoch: number; expiresAt: number };
  /** This is not proof of deletion without independent receipt reconciliation. */
  observed?: { generation: string; observedAt: number };
  completedAt?: number;
  receiptDigest?: string;
  quarantineReason?: PurgeQuarantineReason;
}

function validTime(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}
function validOpaque(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}
function assertValidLeaseInput(token: string, now: number, leaseMs: number): void {
  if (!validOpaque(token) || !validTime(now) || !Number.isSafeInteger(leaseMs) ||
      leaseMs < 1000 || leaseMs > 10 * 60_000 || now + leaseMs > Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_lease');
  }
}
function assertValidState(state: PurgeWorkState): void {
  if (!state || state.schemaVersion !== 1 || !validOpaque(state.key) ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.attempt) || state.attempt < 0 ||
      !validTime(state.availableAt)) {
    throw new Error('purge_work_invalid_state');
  }
}
function assertCurrentLease(state: PurgeWorkState, token: string, epoch: number, now: number): void {
  if (!validTime(now) || !state.lease || state.lease.token !== token ||
      !Number.isSafeInteger(epoch) || state.lease.epoch !== epoch ||
      state.lease.expiresAt <= now) {
    throw new Error('purge_work_stale_or_expired_lease');
  }
}

export function createPurgeWork(key: string, availableAt: number): PurgeWorkState {
  if (!validOpaque(key) || !validTime(availableAt)) throw new Error('purge_work_invalid_source');
  return { schemaVersion: 1, key, status: 'ready', revision: 0, attempt: 0, availableAt };
}

/** Mutually exclusive claim: the persistence adapter must compare-and-swap transactionally. */
export function claimPurgeWork(
  state: PurgeWorkState, token: string, now: number, leaseMs: number,
): PurgeWorkState {
  assertValidState(state);
  assertValidLeaseInput(token, now, leaseMs);
  if (!((state.status === 'ready' && state.availableAt <= now) ||
        (state.status === 'leased' && state.lease && state.lease.expiresAt <= now))) {
    throw new Error('purge_work_not_claimable');
  }
  if (state.revision >= Number.MAX_SAFE_INTEGER || state.attempt >= Number.MAX_SAFE_INTEGER ||
      (state.lease?.epoch ?? 0) >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_counter_exhausted');
  }
  return {
    schemaVersion: 1, key: state.key, status: 'leased',
    revision: state.revision + 1, attempt: state.attempt + 1,
    availableAt: state.availableAt,
    lease: { token, epoch: (state.lease?.epoch ?? 0) + 1, expiresAt: now + leaseMs },
  };
}

/** Only before an irreversible GCS deletion. Never retry a delete from receipt_pending. */
export function releaseUndeletedWork(
  state: PurgeWorkState, token: string, epoch: number, now: number, retryAfter: number,
): PurgeWorkState {
  assertValidState(state);
  if (state.status !== 'leased') throw new Error('purge_work_not_undeleted');
  assertCurrentLease(state, token, epoch, now);
  if (!validTime(retryAfter) || retryAfter <= now || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_retry');
  }
  return {
    schemaVersion: 1, key: state.key, status: 'ready',
    revision: state.revision + 1, attempt: state.attempt,
    availableAt: retryAfter, lease: state.lease,
  };
}

/**
 * Must be called ONLY after generation-fenced GCS success and before the final
 * receipt transition. Crash before this persisted marker remains unresolved;
 * no exactly-once cross-service guarantees are claimed.
 */
export function markDeletionObserved(
  state: PurgeWorkState, token: string, epoch: number, now: number, generation: string,
): PurgeWorkState {
  assertValidState(state);
  if (state.status !== 'leased') throw new Error('purge_work_not_leased');
  assertCurrentLease(state, token, epoch, now);
  if (!/^[1-9][0-9]*$/.test(generation) || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_generation');
  }
  return {
    ...state, status: 'receipt_pending', revision: state.revision + 1,
    observed: { generation, observedAt: now },
  };
}

/** Reclaim only the audit receipt; do NOT repeat the physical GCS delete. */
export function claimReceiptReconciliation(
  state: PurgeWorkState, token: string, now: number, leaseMs: number,
): PurgeWorkState {
  assertValidState(state);
  assertValidLeaseInput(token, now, leaseMs);
  if (state.status !== 'receipt_pending' || !state.observed ||
      !state.lease || state.lease.expiresAt > now ||
      state.revision >= Number.MAX_SAFE_INTEGER || state.lease.epoch >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_receipt_not_claimable');
  }
  return {
    ...state, revision: state.revision + 1,
    lease: { token, epoch: state.lease.epoch + 1, expiresAt: now + leaseMs },
  };
}

/**
 * Called only after an external, independently validated durable audit receipt
 * has been atomically committed by an authorized adapter. No IO performed here.
 */
export function completePurgeReceipt(
  state: PurgeWorkState, token: string, epoch: number, now: number, receiptDigest: string,
): PurgeWorkState {
  assertValidState(state);
  if (state.status !== 'receipt_pending' || !state.observed) throw new Error('purge_work_no_receipt_evidence');
  assertCurrentLease(state, token, epoch, now);
  if (!/^[a-f0-9]{64}$/.test(receiptDigest) || now < state.observed.observedAt ||
      state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_receipt');
  }
  return {
    ...state, status: 'complete', revision: state.revision + 1,
    completedAt: now, receiptDigest,
  };
}

/** Quarantine only unstarted/retryable jobs; preserve observed deletes for audit reconciliation. */
export function quarantinePurgeWork(
  state: PurgeWorkState, reason: PurgeQuarantineReason,
  now: number, token?: string, epoch?: number,
): PurgeWorkState {
  assertValidState(state);
  if (!validTime(now) ||
      !(['invalid_source','ambiguous_ownership','legal_hold',
        'conflicting_decision','unverifiable_generation','manual_review'] as string[]).includes(reason) ||
      state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_quarantine');
  }
  if (state.status === 'leased') {
    if (token === undefined || epoch === undefined) throw new Error('purge_work_lease_required');
    assertCurrentLease(state, token, epoch, now);
  } else if (state.status !== 'ready') {
    throw new Error('purge_work_cannot_quarantine');
  }
  return {
    ...state, status: 'quarantined', revision: state.revision + 1,
    quarantineReason: reason,
  };
}
