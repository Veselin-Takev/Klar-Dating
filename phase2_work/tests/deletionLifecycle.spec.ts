// @vitest-environment node
import { emptyDeletionCounts, deletionReceiptId } from '../src/server/deletionAccounting';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { runAccountDeletion, type DeletionDependencies } from '../src/server/accountDeletion';
import { purgeAccountData } from '../src/server/trustAndSafety';
import { DeletionPageComplete, DeletionTimeSliceComplete } from '../src/server/deletionProgress';
const chatPaths: string[] = [];
afterEach(async () => { for (const path of chatPaths.splice(0)) await getDb().recursiveDelete(getDb().doc(path)); });
const paths: string[] = [];
afterEach(async () => { for (const path of paths.splice(0)) await getDb().doc(path).delete(); });
async function setup() {
  const uid = 'deletion-' + randomUUID(); const ref = getDb().doc(`account_deletions/${uid}`); paths.push(ref.path);
  let now = Date.now();
  const requestId = randomUUID(); paths.push('deletion_log/' + deletionReceiptId(requestId));
  await ref.set({ requestId, accountingVersion: 2, deletedCounts: emptyDeletionCounts(), status: 'pending', phase: 'purge', nextAttemptAt: new Date(now), leaseUntil: 0, attempts: 0, hasDidit: true, subscriptionId: 'sub_test', customerId: 'cus_test' });
  const deps: DeletionDependencies = { db: getDb(), now: () => now, disable: vi.fn(async () => {}), removeAuth: vi.fn(async () => {}),
    purge: vi.fn(async () => {}), eraseProvider: vi.fn(async () => true), cancelSubscription: vi.fn(async () => {}) };
  return { uid, ref, deps, advance: (ms: number) => { now += ms; } };
}
describe('durable account deletion lifecycle', { timeout: 20_000 }, () => {
  it('leases concurrent workers once and completes only after a second sweep after token expiry', async () => {
    const { uid, ref, deps, advance } = await setup();
    await Promise.all([runAccountDeletion(uid, deps), runAccountDeletion(uid, deps)]);
    expect(deps.purge).toHaveBeenCalledTimes(1);
    expect((await ref.get()).data()).toMatchObject({ status: 'pending', phase: 'final_sweep' });
    await runAccountDeletion(uid, deps); expect(deps.purge).toHaveBeenCalledTimes(1);
    advance(62 * 60_000); await runAccountDeletion(uid, deps);
    expect(deps.purge).toHaveBeenCalledTimes(2); expect(deps.removeAuth).toHaveBeenCalledTimes(2);
    const completed = (await ref.get()).data()!;
    expect(completed.status).toBe('completed'); expect(completed).not.toHaveProperty('customerId'); expect(completed).not.toHaveProperty('subscriptionId');
    expect(completed.expiresAt.toMillis()).toBeGreaterThan(completed.completedAt.toMillis());
  });
  it('publishes cumulative totals only with final-sweep job completion', async () => {
    const { uid, ref, deps, advance } = await setup();
    const requestId = (await ref.get()).data()!.requestId as string;
    const receipt = getDb().doc('deletion_log/' + deletionReceiptId(requestId));
    vi.mocked(deps.purge).mockImplementationOnce(async () => {
      await ref.update({ deletedCounts: { ...emptyDeletionCounts(), chats: 51, nachrichten: 102 } });
    }).mockImplementationOnce(async () => {
      await ref.update({ deletedCounts: { ...emptyDeletionCounts(), chats: 52, nachrichten: 103 } });
    });
    await runAccountDeletion(uid, deps);
    expect((await receipt.get()).exists).toBe(false);
    advance(62 * 60_000);
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()?.status).toBe('completed');
    const finalReceipt = (await receipt.get()).data();
    expect(finalReceipt).toMatchObject({ schemaVersion: 2, deletedChats: 52, deletedMessages: 103, status: 'completed' });
    await runAccountDeletion(uid, deps);
    expect((await receipt.get()).data()).toEqual(finalReceipt);
  });

  it('cannot complete the job or overwrite an existing receipt when publication conflicts', async () => {
    const { uid, ref, deps } = await setup();
    await ref.update({ phase: 'final_sweep' });
    const requestId = (await ref.get()).data()!.requestId as string;
    const receipt = getDb().doc('deletion_log/' + deletionReceiptId(requestId));
    await receipt.create({ schemaVersion: 1, status: 'completed', marker: 'legacy' });
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()).toMatchObject({ status: 'pending', lastError: 'retry_required' });
    expect((await receipt.get()).data()).toEqual({ schemaVersion: 1, status: 'completed', marker: 'legacy' });
  });

  it('routes legacy accounting to manual review before provider or identity actions', async () => {
    const { uid, ref, deps } = await setup();
    await ref.update({ accountingVersion: 1 });
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()).toMatchObject({ status: 'manual_review', lastError: 'accounting_migration_required' });
    expect(deps.disable).not.toHaveBeenCalled();
    expect(deps.eraseProvider).not.toHaveBeenCalled();
    expect(deps.purge).not.toHaveBeenCalled();
    expect(deps.removeAuth).not.toHaveBeenCalled();
  });

  it('does not delete authentication after a worker loses its lease', async () => {
    const { uid, ref, deps } = await setup();
    vi.mocked(deps.purge).mockImplementationOnce(async () => {
      await ref.update({ lease: 'another-worker', leaseUntil: Date.now() + 60_000 });
    });
    await runAccountDeletion(uid, deps);
    expect(deps.removeAuth).not.toHaveBeenCalled();
    const afterLeaseLoss = (await ref.get()).data();
    expect(afterLeaseLoss).toMatchObject({ status: 'pending', lease: 'another-worker' });
    expect(afterLeaseLoss).not.toHaveProperty('lastError');
  });

  it('resumes provider and purge failures without deleting authentication prematurely', async () => {
    const { uid, ref, deps, advance } = await setup();
    vi.mocked(deps.eraseProvider).mockResolvedValueOnce(false);
    await runAccountDeletion(uid, deps); expect(deps.purge).not.toHaveBeenCalled(); expect(deps.removeAuth).not.toHaveBeenCalled();
    advance(121_000); vi.mocked(deps.purge).mockRejectedValueOnce(new Error('PII provider failure'));
    await runAccountDeletion(uid, deps); expect(deps.removeAuth).not.toHaveBeenCalled();
    expect((await ref.get()).data()).toMatchObject({ status: 'pending', lastError: 'retry_required' });
    expect(JSON.stringify((await ref.get()).data())).not.toContain('PII');
    advance(241_000); await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()?.phase).toBe('final_sweep');
  });
});

describe('deletion progress and retry budget', { timeout: 30_000 }, () => {
  it('continues beyond 50 completed chat pages without consuming failure attempts', async () => {
    const { uid, ref, deps, advance } = await setup();
    vi.mocked(deps.purge).mockImplementation(async () => { throw new DeletionPageComplete(); });
    for (let page = 0; page < 51; page += 1) {
      await runAccountDeletion(uid, deps);
      advance(1_001);
    }
    expect((await ref.get()).data()).toMatchObject({ status: 'pending', attempts: 0, completedPages: 51 });
    expect(deps.removeAuth).not.toHaveBeenCalled();
    vi.mocked(deps.purge).mockResolvedValue(undefined);
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()?.phase).toBe('final_sweep');
    advance(62 * 60_000);
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()?.status).toBe('completed');
  });

  it('preserves the failure budget for confirmed within-page progress without declaring a full page', async () => {
    const { uid, ref, deps, advance } = await setup();
    await ref.update({ attempts: 2 });
    vi.mocked(deps.purge).mockRejectedValue(new DeletionTimeSliceComplete());
    for (let slice = 0; slice < 51; slice += 1) {
      await runAccountDeletion(uid, deps);
      advance(1_001);
    }
    const job = (await ref.get()).data();
    expect(job).toMatchObject({ status: 'pending', attempts: 2, completedSlices: 51 });
    expect(job).not.toHaveProperty('completedPages');
    expect(deps.removeAuth).not.toHaveBeenCalled();
  });

  it('does not forgive real failures when a later page makes progress', async () => {
    const { uid, ref, deps, advance } = await setup();
    vi.mocked(deps.purge).mockRejectedValueOnce(new Error('database unavailable'));
    await runAccountDeletion(uid, deps);
    advance(241_000);
    vi.mocked(deps.purge).mockRejectedValueOnce(new DeletionPageComplete());
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()).toMatchObject({ status: 'pending', attempts: 1, completedPages: 1 });
  });

  it('stops at 50 actual failures and never automatically acquires manual-review jobs', async () => {
    const { uid, ref, deps, advance } = await setup();
    await ref.update({ attempts: 49 });
    vi.mocked(deps.purge).mockRejectedValue(new Error('database unavailable'));
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()).toMatchObject({ status: 'manual_review', attempts: 50 });
    await ref.update({ nextAttemptAt: new Date(0) });
    advance(3_600_000);
    await runAccountDeletion(uid, deps);
    expect(deps.purge).toHaveBeenCalledTimes(1);
    expect(deps.removeAuth).not.toHaveBeenCalled();
  });

  it('does not delete authentication after its lease expires', async () => {
    const { uid, ref, deps, advance } = await setup();
    vi.mocked(deps.purge).mockImplementationOnce(async () => { advance(11 * 60_000); });
    await runAccountDeletion(uid, deps);
    expect(deps.removeAuth).not.toHaveBeenCalled();
    expect((await ref.get()).data()?.status).toBe('pending');
  });

  it('cannot overwrite a replacement lease when a page finishes', async () => {
    const { uid, ref, deps } = await setup();
    vi.mocked(deps.purge).mockImplementationOnce(async () => {
      await ref.update({ lease: 'replacement', completedPages: 7 });
      throw new DeletionPageComplete();
    });
    await runAccountDeletion(uid, deps);
    expect((await ref.get()).data()).toMatchObject({ lease: 'replacement', completedPages: 7 });
    expect(deps.removeAuth).not.toHaveBeenCalled();
  });
});

describe('real chat purge pagination', { timeout: 30_000 }, () => {
  it('deletes two bounded pages with their messages and gate answers, preserving other chats', async () => {
    const db = getDb();
    const uid = 'purge-pages-' + randomUUID();
    const requestId = randomUUID();
    const job = db.doc(`account_deletions/${uid}`); paths.push(job.path);
    await job.set({ requestId, status: 'pending', accountingVersion: 2, deletedCounts: emptyDeletionCounts() });
    const batch = db.batch();
    const owned = Array.from({ length: 51 }, (_, index) => db.collection('chats').doc(uid + '-' + index));
    const unrelated = db.collection('chats').doc(uid + '-unrelated');
    for (const ref of [...owned, unrelated]) {
      chatPaths.push(ref.path);
      batch.set(ref, { participants: ref.id.endsWith('-unrelated') ? ['another-user'] : [uid] });
      for (const collection of ['messages', 'archived_messages', 'gate_answers']) {
        batch.set(ref.collection(collection).doc('test'), { text: 'test data' });
      }
    }
    await batch.commit();
    for (const remaining of [26, 1]) {
      await expect(purgeAccountData(uid, requestId)).rejects.toBeInstanceOf(DeletionPageComplete);
      expect((await db.collection('chats').where('participants', 'array-contains', uid).get()).size).toBe(remaining);
    }
    const snapshots = await Promise.all(owned.map(ref => ref.get()));
    for (const snapshot of snapshots.filter(item => !item.exists)) {
      for (const collection of ['messages', 'archived_messages', 'gate_answers']) {
        expect((await snapshot.ref.collection(collection).get()).empty).toBe(true);
      }
    }
    expect((await unrelated.get()).exists).toBe(true);
    expect((await unrelated.collection('messages').doc('test').get()).exists).toBe(true);
  });
});
