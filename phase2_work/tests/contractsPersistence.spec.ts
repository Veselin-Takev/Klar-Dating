// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { getServiceRepository } from '../src/server/firestoreRepository/nativeDatabase';
import { acceptDeclaration, declarationSchema, processContractCancellation } from '../src/server/contracts';
import { deliverContractReceipt } from '../src/server/complianceJobs';
const paths = new Set<string>();
const repository = () => getServiceRepository('payments');
const scoped = (path: string) => getDb().doc('tenants/default/' + path);
beforeEach(() => vi.stubEnv('KLAR_TENANT_PAYMENTS_MIGRATION_READY', 'true'));
function input() { const requestId = randomUUID(); paths.add(`contract_requests/${requestId}`); return declarationSchema.parse({ requestId, kind: 'cancel', language: 'en', name: 'Test Person', email: 'test@example.test', contract: 'Klar Plus' }); }
afterEach(async () => { vi.unstubAllEnvs(); for (const path of paths) await scoped(path).delete(); paths.clear(); });
describe('contract declarations, confirmations and provider cancellation', { timeout: 60_000 }, () => {
  it('atomically accepts unauthenticated declarations once without disclosing contract existence', async () => {
    const data = input(); const receipts = await Promise.all([acceptDeclaration(repository(), data), acceptDeclaration(repository(), data)]);
    expect(receipts[0]).toEqual(receipts[1]); expect(receipts[0]!.text).toContain('earliest possible date');
    const stored = (await scoped(`contract_requests/${data.requestId}`).get()).data()!;
    expect(stored).toMatchObject({ uid: null, processingStatus: 'review_required', mailStatus: 'pending' });
    await expect(acceptDeclaration(repository(), { ...data, email: 'other@example.test' })).rejects.toThrow('request_conflict');
  });
  it('leaves an outage retryable and does not mark cancellation complete until Stripe confirms', async () => {
    const data = input(); const uid = 'contract-' + randomUUID(); paths.add(`users/${uid}`); paths.add(`subscriptions/${uid}`); paths.add(`subscription_events/${data.requestId}`);
    await scoped(`users/${uid}`).set({ subscriptionId: 'sub_test', stripeCustomerId: 'cus_test', plan: 'plus' });
    await scoped(`subscriptions/${uid}`).set({ plan: 'plus', subscriptionId: 'sub_test', stripeCustomerId: 'cus_test', autoRenew: true });
    await acceptDeclaration(repository(), data, uid);
    const stripe = { subscriptions: { retrieve: vi.fn(async () => ({ metadata: {klarTenantId: 'default'}, customer: 'cus_test', status: 'active', ended_at: null })),
      update: vi.fn().mockRejectedValueOnce(new Error('outage')).mockResolvedValueOnce({ cancel_at: 1_900_000_000 }) } };
    await expect(processContractCancellation(data.requestId, repository(), stripe as unknown as Parameters<typeof processContractCancellation>[2])).rejects.toThrow('outage');
    expect((await scoped(`contract_requests/${data.requestId}`).get()).data()?.processingStatus).toBe('pending');
    await processContractCancellation(data.requestId, repository(), stripe as unknown as Parameters<typeof processContractCancellation>[2]);
    expect(stripe.subscriptions.update).toHaveBeenLastCalledWith('sub_test', { cancel_at_period_end: true }, { idempotencyKey: `klar-cancel-${data.requestId}` });
    expect((await scoped(`contract_requests/${data.requestId}`).get()).data()?.processingStatus).toBe('completed');
  });
  it('leases confirmation delivery across workers and keeps provider errors in the outbox', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'test-only-key'); vi.stubEnv('SENDGRID_FROM_EMAIL', 'sender@example.test');
    const data = input(); await acceptDeclaration(repository(), data);
    const send = vi.fn(async () => new Response('', { status: 202 }));
    await Promise.all([deliverContractReceipt(data.requestId, repository(), send), deliverContractReceipt(data.requestId, repository(), send)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await scoped(`contract_requests/${data.requestId}`).get()).data()?.mailStatus).toBe('accepted');
    const other = input(); await acceptDeclaration(repository(), other);
    await deliverContractReceipt(other.requestId, repository(), vi.fn(async () => new Response('', { status: 503 })));
    expect((await scoped(`contract_requests/${other.requestId}`).get()).data()?.mailStatus).toBe('pending');
  });
  it('withdraws once through the scoped ledger and leaves root and foreign data untouched', async () => {
    const data = declarationSchema.parse({...input(), kind: 'withdraw'}), uid = 'withdraw-' + randomUUID(), sub = 'sub_' + randomUUID();
    for (const path of [`users/${uid}`, `subscriptions/${uid}`, `refund_queue/${data.requestId}`, `processed_stripe_events/subscription_${sub}`]) paths.add(path);
    const own = scoped(`users/${uid}`), root = getDb().doc(`users/${uid}`), foreign = getDb().doc(`tenants/foreign/users/${uid}`);
    await own.set({subscriptionId: sub, stripeCustomerId: 'cus_test', plan: 'plus'});
    await Promise.all([root.set({marker: 'untouched'}), foreign.set({marker: 'untouched'})]);
    const stripe = { subscriptions: { retrieve: vi.fn(async () => ({ metadata: {klarTenantId: 'default'}, customer: 'cus_test', status: 'active', ended_at: null })), cancel: vi.fn(async () => ({ended_at: 1_900_000_000})) } };
    try {
      await acceptDeclaration(repository(), data, uid);
      await processContractCancellation(data.requestId, repository(), stripe as unknown as Parameters<typeof processContractCancellation>[2]);
      await processContractCancellation(data.requestId, repository(), stripe as unknown as Parameters<typeof processContractCancellation>[2]);
      expect(stripe.subscriptions.cancel).toHaveBeenCalledOnce();
      expect((await scoped(`refund_queue/${data.requestId}`).get()).data()).toMatchObject({subscriptionId: sub, status: 'review_required', grund: 'widerruf'});
      expect((await own.get()).data()?.plan).toBe('free');
      expect((await root.get()).data()).toEqual({marker: 'untouched'}); expect((await foreign.get()).data()).toEqual({marker: 'untouched'});
    } finally {await Promise.all([root.delete(), foreign.delete()]);}
  });
  it('rejects foreign provider subscriptions before cancellation or withdrawal', async () => {
    const data = input(), uid = 'contract-' + randomUUID(); paths.add(`users/${uid}`); paths.add(`subscriptions/${uid}`); paths.add(`subscription_events/${data.requestId}`);
    await scoped(`users/${uid}`).set({subscriptionId: 'sub_foreign', stripeCustomerId: 'cus_test', plan: 'plus'});
    await scoped(`subscriptions/${uid}`).set({plan: 'plus'});
    await acceptDeclaration(repository(), data, uid);
    const update = vi.fn(), stripe = {subscriptions: {retrieve: async () => ({metadata: {klarTenantId: 'foreign'}, customer: 'cus_test', status: 'active'}), update}};
    await expect(processContractCancellation(data.requestId, repository(), stripe as unknown as Parameters<typeof processContractCancellation>[2])).rejects.toThrow('contract_mismatch');
    expect(update).not.toHaveBeenCalled();
    expect((await scoped(`contract_requests/${data.requestId}`).get()).data()?.processingStatus).toBe('pending');
  });

});
