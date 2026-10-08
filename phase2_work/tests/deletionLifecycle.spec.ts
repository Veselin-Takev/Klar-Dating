// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { runAccountDeletion, type DeletionDependencies } from '../src/server/accountDeletion';
const paths: string[] = [];
afterEach(async () => { for (const path of paths.splice(0)) await getDb().doc(path).delete(); });
async function setup() {
  const uid = 'deletion-' + randomUUID(); const ref = getDb().doc(`account_deletions/${uid}`); paths.push(ref.path);
  let now = Date.now();
  await ref.set({ requestId: randomUUID(), status: 'pending', phase: 'purge', nextAttemptAt: new Date(now), leaseUntil: 0, attempts: 0, hasDidit: true, subscriptionId: 'sub_test', customerId: 'cus_test' });
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
  it('does not delete authentication after a worker loses its lease', async () => {
    const { uid, ref, deps } = await setup();
    vi.mocked(deps.purge).mockImplementationOnce(async () => {
      await ref.update({ lease: 'another-worker', leaseUntil: Date.now() + 60_000 });
    });
    await runAccountDeletion(uid, deps);
    expect(deps.removeAuth).not.toHaveBeenCalled();
    expect((await ref.get()).data()).toMatchObject({
      status: 'pending',
      lastError: 'retry_required',
    });
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
