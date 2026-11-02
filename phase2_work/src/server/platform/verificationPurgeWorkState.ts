/**
 * P0 #202 — Inert, pure retention work-state transitions.
 *
 * Not wired to any endpoint, Scheduler, Cloud Storage or database. An approved
 * adapter MUST commit each transition atomically in a Firestore transaction,
 * re-read authoritative decision/legal holds, and persist a durable receipt.
 *
 * No physical delete, external IO, or source identifiers occur in this module.
 */
export type PurgeWorkStatus = 'ready' | 'leased' | 'delete_intent' | 'receipt_pending' | 'complete' | 'quarantined';
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
  /** MUST be persisted in a transaction before any physical GCS request. */
  intent?: { generation: string; preparedAt: number; leaseEpoch: number };
  /** This is not proof of deletion without independent receipt reconciliation. */
  observed?: { generation: string; observedAt: number };
  completedAt?: number;
  receiptDigest?: string;
  quarantineReason?: PurgeQuarantineReason;
}

/**
 * GCS generation is a canonical unsigned 64-bit decimal string. Never convert
 * it to a JS number: precision is lost above Number.MAX_SAFE_INTEGER.
 * Restrict size before parsing/comparison so malformed input cannot expand
 * a write-ahead intent or trigger expensive validation.
 */
export function isCanonicalGcsGeneration(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value)) return false;
  return value.length < 20 || value <= '18446744073709551615';
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
  // A ready/leased row may carry a retained lease for epoch fencing, but it
  // must NEVER carry a prior delete intent, observation or terminal receipt.
  // Corrupt records are quarantined operationally, not silently re-claimed.
  if ((state.status === 'ready' || state.status === 'leased') &&
      (state.intent !== undefined || state.observed !== undefined ||
       state.completedAt !== undefined || state.receiptDigest !== undefined ||
       state.quarantineReason !== undefined)) {
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
 * Write-ahead intent MUST commit atomically before invoking a generation-fenced
 * GCS delete. After an intent, expiry NEVER re-enables physical deletion:
 * an HTTP timeout/crash cannot distinguish success from non-delivery.
 */
export function markDeletionIntent(
  state: PurgeWorkState, token: string, epoch: number, now: number, generation: string,
): PurgeWorkState {
  assertValidState(state);
  if (state.status !== 'leased') throw new Error('purge_work_not_leased');
  assertCurrentLease(state, token, epoch, now);
  if (!isCanonicalGcsGeneration(generation) || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_invalid_generation');
  }
  return {
    ...state, status: 'delete_intent', revision: state.revision + 1,
    intent: { generation, preparedAt: now, leaseEpoch: epoch },
  };
}

/** 
 * Pure, read-only recovery policy. None of the outcomes authorizes another
 * physical delete. A not-found object is AMBIGUOUS without independently
 * authenticated, generation-bound GCS operation and audit evidence.
 */
export type GcsIntentObservation =
  | { kind: 'present'; generation: string }
  | { kind: 'not_found' }
  | { kind: 'unknown' };
export type IntentRecoveryAssessment = {
  action: 'manual_reconcile';
  physicalDeleteAuthorized: false;
  reason: 'same_generation_present' | 'replacement_detected' | 'absence_ambiguous' | 'unverifiable';
};
export function assessDeletionIntentRecovery(
  state: PurgeWorkState, observation: GcsIntentObservation,
): IntentRecoveryAssessment {
  assertValidState(state);
  if (state.status !== 'delete_intent' || !state.intent ||
      !isCanonicalGcsGeneration(state.intent.generation)) {
    throw new Error('purge_work_no_persisted_delete_intent');
  }
  if (observation?.kind === 'not_found') {
    return { action: 'manual_reconcile', physicalDeleteAuthorized: false, reason: 'absence_ambiguous' };
  }
  if (observation?.kind === 'present') {
    if (!isCanonicalGcsGeneration(observation.generation)) {
      return { action: 'manual_reconcile', physicalDeleteAuthorized: false, reason: 'unverifiable' };
    }
    return {
      action: 'manual_reconcile', physicalDeleteAuthorized: false,
      reason: observation.generation === state.intent.generation
        ? 'same_generation_present' : 'replacement_detected',
    };
  }
  return { action: 'manual_reconcile', physicalDeleteAuthorized: false, reason: 'unverifiable' };
}

/**
 * Only a worker that has verifiably received generation-fenced GCS success can
 * record an observation. A crash before this marker keeps delete_intent.
 * This pure transition cannot itself verify external GCS success.
 */
/**
 * A persisted write-ahead intent and a later GCS observation must agree on
 * a canonical uint64 generation before receipt-only progression. Equality
 * alone is NOT evidence when both values were stored in a malformed row.
 * Never authorizes a physical GCS delete or trusts a receipt signature.
 */
export function hasCanonicalGcsReceiptEvidence(
  state: PurgeWorkState,
): state is PurgeWorkState & {
  intent: NonNullable<PurgeWorkState['intent']>;
  observed: NonNullable<PurgeWorkState['observed']>;
} {
  return !!state.intent && !!state.observed &&
    isCanonicalGcsGeneration(state.intent.generation) &&
    isCanonicalGcsGeneration(state.observed.generation) &&
    state.intent.generation === state.observed.generation;
}

export function markDeletionObserved(
  state: PurgeWorkState, token: string, epoch: number, now: number, generation: string,
): PurgeWorkState {
  assertValidState(state);
  if (state.status !== 'delete_intent' || !state.intent) throw new Error('purge_work_missing_delete_intent');
  assertCurrentLease(state, token, epoch, now);
  if (!isCanonicalGcsGeneration(state.intent.generation) ||
      !isCanonicalGcsGeneration(generation) ||
      state.intent.leaseEpoch !== epoch || state.intent.generation !== generation ||
      now < state.intent.preparedAt || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('purge_work_intent_mismatch');
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
  if (state.status !== 'receipt_pending' || !hasCanonicalGcsReceiptEvidence(state) ||
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
  if (state.status !== 'receipt_pending' || !hasCanonicalGcsReceiptEvidence(state)) {
    throw new Error('purge_work_no_receipt_evidence');
  }
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
