// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { transitionPurgeWorkInTransaction } from '../src/server/platform/verificationPurgeWorkFirestore';
import { createPurgeWork, claimPurgeWork, claimReceiptReconciliation, completePurgeReceipt, markDeletionIntent, markDeletionObserved, quarantinePurgeWork, releaseUndeletedWork, type PurgeWorkState } from '../src/server/platform/verificationPurgeWorkState';

const key = 'a'.repeat(64);
const token = 'worker-opaque-token-0000001';
const now = 1_798_000_000_000;
const ref = { id: key, parent: { path: 'verification_purge_jobs' } } as DocumentReference;

function memoryDb(initial?: PurgeWorkState, replayCount = 1) {
  let stored = initial ?? createPurgeWork(key, now);
  const writes: PurgeWorkState[] = [];
  let reads = 0;
  const db = {
    runTransaction: async (fn: (tx: unknown) => Promise<PurgeWorkState>) => {
      for (let i = 0; i < replayCount; i++) {
        let next: PurgeWorkState | undefined;
        const tx = {
          get: async () => { reads++; return { exists: true, data: () => stored }; },
          update: (_ref: unknown, value: PurgeWorkState) => { next = value; },
        };
        const result = await fn(tx);
        // Simulate a contention retry where the first attempt was aborted.
        if (i === replayCount - 1) {
          expect(next).toEqual(result);
          stored = result;
          writes.push(result);
        }
      }
      return stored;
    },
  } as unknown as Pick<Firestore, 'runTransaction'>;
  return { db, writes, getStored: () => stored, getReads: () => reads };
}

describe('P0 #202 Firestore transaction adapter is opt-in, bounded and retry-safe', () => {
  it('reads before updating and commits a single lease claim', async () => {
    const m = memoryDb();
    const actual = await transitionPurgeWorkInTransaction(m.db, ref,
      current => claimPurgeWork(current, token, now, 5_000));
    expect(actual.status).toBe('leased');
    expect(actual.revision).toBe(1);
    expect(m.getStored()).toEqual(actual);
    expect(m.getReads()).toBe(1);
    expect(m.writes).toHaveLength(1);
  });

  it('does not create duplicate writes when SDK retries a pure callback', async () => {
    const m = memoryDb(undefined, 2);
    const externalEffect = vi.fn();
    const actual = await transitionPurgeWorkInTransaction(m.db, ref, current => {
      // A read-only deterministic transform, not an external GCS call.
      return claimPurgeWork(current, token, now, 5_000);
    });
    expect(actual.attempt).toBe(1);
    expect(actual.revision).toBe(1);
    expect(m.getReads()).toBe(2);
    expect(m.writes).toHaveLength(1);
    expect(externalEffect).not.toHaveBeenCalled();
  });

  it('persists write-ahead delete intent via a replay-safe, read-before-write transaction', async () => {
    const initial = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const m = memoryDb(initial, 2);
    const intent = await transitionPurgeWorkInTransaction(m.db, ref,
      state => markDeletionIntent(state, token, 1, now + 500, '18446744073709551615'));
    expect(intent).toMatchObject({
      status: 'delete_intent', revision: 2,
      intent: { generation: '18446744073709551615', leaseEpoch: 1, preparedAt: now + 500 },
    });
    expect(m.writes).toHaveLength(1);
    expect(m.getReads()).toBe(2);
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      state => claimPurgeWork(state, 'another-token-00000000000', now + 8_000, 5_000)))
      .rejects.toThrow('purge_work_not_claimable');
    expect(m.writes).toHaveLength(1);
  });

  it('denies a forged complete receipt directly from ready without any delete intent', async () => {
    const m = memoryDb();
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'complete', revision: 1, receiptDigest: 'a'.repeat(64), completedAt: now + 1 })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
    expect(m.getStored().status).toBe('ready');
  });

  it('denies a fabricated receipt_pending transition without a committed intent', async () => {
    const claimed = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const m = memoryDb(claimed);
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'receipt_pending', revision: current.revision + 1,
        observed: { generation: '123', observedAt: now + 100 } })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
  });

  it('denies mutating the write-ahead generation or falling back to ready', async () => {
    const claimed = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const prepared = markDeletionIntent(claimed, token, 1, now + 100, '123');
    const m = memoryDb(prepared);
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'receipt_pending', revision: current.revision + 1,
        intent: { ...prepared.intent!, generation: '124' },
        observed: { generation: '124', observedAt: now + 200 } })))
      .rejects.toThrow('purge_work_transition_invariant');
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'ready', revision: current.revision + 1, intent: undefined })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
  });

  it('accepts genuine intent-to-observation transition without changing immutable generation', async () => {
    const claimed = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const prepared = markDeletionIntent(claimed, token, 1, now + 100, '123');
    const m = memoryDb(prepared);
    const observed = await transitionPurgeWorkInTransaction(m.db, ref,
      current => markDeletionObserved(current, token, 1, now + 200, '123'));
    expect(observed).toMatchObject({ status: 'receipt_pending', revision: 3,
      intent: { generation: '123', leaseEpoch: 1 }, observed: { generation: '123' } });
    expect(m.writes).toHaveLength(1);
  });

  it('rejects forged lease token/attempt/epoch that still obeys a status allowlist', async () => {
    const m = memoryDb();
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'leased', revision: current.revision + 1,
        lease: { token, epoch: 1, expiresAt: now + 5_000 } })))
      .rejects.toThrow('purge_work_transition_invariant');
    const legitimate = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const locked = memoryDb(legitimate);
    await expect(transitionPurgeWorkInTransaction(locked.db, ref,
      current => ({ ...current, revision: current.revision + 1, status: 'delete_intent',
        lease: { ...current.lease!, token: 'forged-worker-token-000001' },
        intent: { generation: '987', leaseEpoch: 1, preparedAt: now + 100 } })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
    expect(locked.writes).toHaveLength(0);
  });

  it('rejects forged observation time, changed leased worker, and fabricated early receipt', async () => {
    const claimed = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const prepared = markDeletionIntent(claimed, token, 1, now + 500, '123');
    const m = memoryDb(prepared);
    for (const override of [
      { observedAt: now + 200, lease: prepared.lease },
      { observedAt: now + 1_000, lease: { ...prepared.lease!, token: 'forged-worker-token-000001' } },
      { observedAt: now + 8_000, lease: prepared.lease },
    ]) {
      await expect(transitionPurgeWorkInTransaction(m.db, ref,
        current => ({ ...current, status: 'receipt_pending', revision: current.revision + 1,
          lease: override.lease, observed: { generation: '123', observedAt: override.observedAt } })))
        .rejects.toThrow('purge_work_transition_invariant');
    }
    expect(m.writes).toHaveLength(0);
  });

  it('cannot forge another worker or a future completion time after observed deletion', async () => {
    const base = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const intent = markDeletionIntent(base, token, 1, now + 500, '456');
    const observed = markDeletionObserved(intent, token, 1, now + 1_000, '456');
    const m = memoryDb(observed);
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'complete', revision: current.revision + 1,
        lease: { ...current.lease!, token: 'forged-worker-token-000001' },
        completedAt: now + 2_000, receiptDigest: 'a'.repeat(64) })))
      .rejects.toThrow('purge_work_transition_invariant');
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...current, status: 'complete', revision: current.revision + 1,
        completedAt: now + 10_000, receiptDigest: 'a'.repeat(64) })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
  });

  it('still allows canonical lease release, quarantine, receipt-only reclaim and completion', async () => {
    const claimed = claimPurgeWork(createPurgeWork(key, now), token, now, 5_000);
    const releaseDb = memoryDb(claimed);
    const released = await transitionPurgeWorkInTransaction(releaseDb.db, ref,
      current => releaseUndeletedWork(current, token, 1, now + 500, now + 9_000));
    expect(released).toMatchObject({ status: 'ready', availableAt: now + 9_000 });
    const quarantineDb = memoryDb(claimed);
    const quarantined = await transitionPurgeWorkInTransaction(quarantineDb.db, ref,
      current => quarantinePurgeWork(current, 'legal_hold', now + 500, token, 1));
    expect(quarantined).toMatchObject({ status: 'quarantined', quarantineReason: 'legal_hold' });

    const prepared = markDeletionIntent(claimed, token, 1, now + 500, '123');
    const observed = markDeletionObserved(prepared, token, 1, now + 1_000, '123');
    const reconcileDb = memoryDb(observed);
    const reclaimed = await transitionPurgeWorkInTransaction(reconcileDb.db, ref,
      current => claimReceiptReconciliation(current, 'receipt-only-worker-0000001', now + 5_000, 5_000));
    expect(reclaimed).toMatchObject({ status: 'receipt_pending', lease: { epoch: 2 } });
    const receiptDb = memoryDb(reclaimed);
    const completed = await transitionPurgeWorkInTransaction(receiptDb.db, ref,
      current => completePurgeReceipt(current, 'receipt-only-worker-0000001', 2, now + 5_500, 'a'.repeat(64)));
    expect(completed).toMatchObject({ status: 'complete', receiptDigest: 'a'.repeat(64) });
  });

  it('rejects forged document references and changed immutable identity', async () => {
    const m = memoryDb();
    const foreign = { ...ref, parent: { path: 'users' } } as DocumentReference;
    await expect(transitionPurgeWorkInTransaction(m.db, foreign,
      current => claimPurgeWork(current, token, now, 5_000)))
      .rejects.toThrow('purge_work_invalid_document_reference');
    await expect(transitionPurgeWorkInTransaction(m.db, ref,
      current => ({ ...claimPurgeWork(current, token, now, 5_000), key: 'z'.repeat(64) })))
      .rejects.toThrow('purge_work_transition_invariant');
    expect(m.writes).toHaveLength(0);
  });

  it('rejects missing or wrong-schema source before any transactional write', async () => {
    const malformed = memoryDb({ ...createPurgeWork(key, now), schemaVersion: 99 } as unknown as PurgeWorkState);
    await expect(transitionPurgeWorkInTransaction(malformed.db, ref,
      current => claimPurgeWork(current, token, now, 5_000)))
      .rejects.toThrow('purge_work_invalid_stored_state');
    expect(malformed.writes).toHaveLength(0);
    const missing = {
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async () => ({ exists: false }),
        update: () => { throw new Error('must not write missing row'); },
      }),
    } as unknown as Pick<Firestore, 'runTransaction'>;
    await expect(transitionPurgeWorkInTransaction(missing, ref,
      current => claimPurgeWork(current, token, now, 5_000)))
      .rejects.toThrow('purge_work_missing_document');
  });
});
