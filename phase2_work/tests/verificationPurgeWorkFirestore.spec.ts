// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import {
  executePurgeWorkCommand, type PurgeWorkCommand,
} from '../src/server/platform/verificationPurgeWorkFirestore';
import {
  claimPurgeWork, createPurgeWork, markDeletionIntent, type PurgeWorkState,
} from '../src/server/platform/verificationPurgeWorkState';

const key = 'a'.repeat(64);
const tokenA = 'worker-opaque-token-0000001';
const tokenB = 'worker-opaque-token-0000002';
const now = 1_798_000_000_000;
const ref = { id: key, parent: { path: 'verification_purge_jobs' } } as DocumentReference;
const claim: PurgeWorkCommand = { kind: 'claim', token: tokenA, now, leaseMs: 5_000 };
const intent: PurgeWorkCommand = {
  kind: 'prepare_delete_intent', token: tokenA, epoch: 1, now: now + 100, generation: '18446744073709551615',
};

function memoryDb(initial?: PurgeWorkState, retryCount = 1) {
  let stored = initial ?? createPurgeWork(key, now);
  const writes: PurgeWorkState[] = [];
  let reads = 0;
  let calls = 0;
  const db = {
    runTransaction: async (fn: (tx: unknown) => Promise<PurgeWorkState>) => {
      calls++;
      let final: PurgeWorkState | undefined;
      for (let i = 0; i < retryCount; i++) {
        let attempted: PurgeWorkState | undefined;
        const tx = {
          get: async () => { reads++; return { exists: true, data: () => stored }; },
          update: (_ref: unknown, value: PurgeWorkState) => { attempted = value; },
        };
        const result = await fn(tx);
        expect(attempted).toEqual(result);
        if (i === retryCount - 1) {
          stored = result;
          final = result;
          writes.push(result);
        }
      }
      return final;
    },
  } as unknown as Pick<Firestore, 'runTransaction'>;
  return { db, writes, getStored: () => stored, getReads: () => reads, getCalls: () => calls };
}

describe('P0 #202 typed Firestore CAS command boundary (unused in production)', () => {
  it('claims exclusively through a typed, replay-safe command', async () => {
    const m = memoryDb(undefined, 2);
    const result = await executePurgeWorkCommand(m.db, ref, claim);
    expect(result).toMatchObject({ status: 'leased', revision: 1, attempt: 1,
      lease: { epoch: 1, token: tokenA } });
    expect(m.getReads()).toBe(2);
    expect(m.writes).toHaveLength(1);
    await expect(executePurgeWorkCommand(m.db, ref, claim))
      .rejects.toThrow('purge_work_not_claimable');
    expect(m.writes).toHaveLength(1);
  });

  it('commits write-ahead intent before a receipt can be attempted', async () => {
    const m = memoryDb(claimPurgeWork(createPurgeWork(key, now), tokenA, now, 5_000), 2);
    const persisted = await executePurgeWorkCommand(m.db, ref, intent);
    expect(persisted).toMatchObject({ status: 'delete_intent', revision: 2,
      intent: { generation: '18446744073709551615', leaseEpoch: 1, preparedAt: now + 100 } });
    expect(m.writes).toHaveLength(1);
    await expect(executePurgeWorkCommand(m.db, ref, {
      kind: 'claim', token: tokenB, now: now + 9_000, leaseMs: 5_000,
    })).rejects.toThrow('purge_work_not_claimable');
  });

  it('supports pre-delete release and safe quarantine only', async () => {
    const initial = claimPurgeWork(createPurgeWork(key, now), tokenA, now, 5_000);
    const m = memoryDb(initial);
    const ready = await executePurgeWorkCommand(m.db, ref, {
      kind: 'release_undeleted', token: tokenA, epoch: 1, now: now + 500, retryAfter: now + 9_000,
    });
    expect(ready).toMatchObject({ status: 'ready', revision: 2, attempt: 1, availableAt: now + 9_000 });
    const held = memoryDb(initial);
    expect(await executePurgeWorkCommand(held.db, ref, {
      kind: 'quarantine', reason: 'legal_hold', token: tokenA, epoch: 1, now: now + 500,
    })).toMatchObject({ status: 'quarantined', quarantineReason: 'legal_hold' });
  });

  it.each(['receipt_pending','complete','mark_delete_observed','raw_transform'] as const)(
    'rejects unsupported or forged command %s before any Firestore transaction', async kind => {
      const m = memoryDb();
      await expect(executePurgeWorkCommand(m.db, ref, {
        kind, token: tokenA, now, generation: '123', receiptDigest: 'b'.repeat(64),
      } as unknown as PurgeWorkCommand)).rejects.toThrow('purge_work_unsupported_command');
      expect(m.getCalls()).toBe(0);
      expect(m.writes).toHaveLength(0);
    },
  );

  it('rejects a forged transform function or any hidden lease field', async () => {
    const m = memoryDb();
    await expect(executePurgeWorkCommand(m.db, ref,
      ((current: PurgeWorkState) => ({ ...current, status: 'complete' })) as unknown as PurgeWorkCommand))
      .rejects.toThrow('purge_work_unsupported_command');
    await expect(executePurgeWorkCommand(m.db, ref, {
      ...claim, lease: { token: tokenB, epoch: 999 },
    } as unknown as PurgeWorkCommand)).rejects.toThrow('purge_work_unsupported_command');
    expect(m.getCalls()).toBe(0);
  });

  it('rejects stale worker token and mismatched generation', async () => {
    const prepared = claimPurgeWork(createPurgeWork(key, now), tokenA, now, 5_000);
    const m = memoryDb(prepared);
    await expect(executePurgeWorkCommand(m.db, ref, {
      kind: 'prepare_delete_intent', token: tokenB, epoch: 1, now: now + 100, generation: '99',
    })).rejects.toThrow('purge_work_stale_or_expired_lease');
    await expect(executePurgeWorkCommand(m.db, ref, {
      kind: 'prepare_delete_intent', token: tokenA, epoch: 1, now: now + 100, generation: '0',
    })).rejects.toThrow('purge_work_invalid_generation');
    expect(m.writes).toHaveLength(0);
  });

  it('cannot turn an ambiguous existing intent into a fresh delete', async () => {
    const prepared = markDeletionIntent(
      claimPurgeWork(createPurgeWork(key, now), tokenA, now, 5_000), tokenA, 1, now + 100, '123');
    const m = memoryDb(prepared);
    await expect(executePurgeWorkCommand(m.db, ref, {
      kind: 'claim', token: tokenB, now: now + 30_000, leaseMs: 5_000,
    })).rejects.toThrow('purge_work_not_claimable');
    await expect(executePurgeWorkCommand(m.db, ref, {
      kind: 'release_undeleted', token: tokenA, epoch: 1, now: now + 200, retryAfter: now + 500,
    })).rejects.toThrow('purge_work_not_undeleted');
    expect(m.writes).toHaveLength(0);
  });

  it('rejects forged reference, absent record, schema errors without writes', async () => {
    const m = memoryDb();
    await expect(executePurgeWorkCommand(m.db, { ...ref, parent: { path: 'users' } } as DocumentReference, claim))
      .rejects.toThrow('purge_work_invalid_document_reference');
    const wrong = memoryDb({ ...createPurgeWork(key, now), schemaVersion: 9 } as unknown as PurgeWorkState);
    await expect(executePurgeWorkCommand(wrong.db, ref, claim))
      .rejects.toThrow('purge_work_invalid_stored_state');
    const missing = {
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async () => ({ exists: false }),
        update: () => { throw new Error('must not write'); },
      }),
    } as unknown as Pick<Firestore, 'runTransaction'>;
    await expect(executePurgeWorkCommand(missing, ref, claim))
      .rejects.toThrow('purge_work_missing_document');
    expect(m.writes).toHaveLength(0);
    expect(wrong.writes).toHaveLength(0);
  });
});
