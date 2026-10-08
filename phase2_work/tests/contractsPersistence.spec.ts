// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { acceptDeclaration, declarationSchema, processContractCancellation } from '../src/server/contracts';
import { deliverContractReceipt } from '../src/server/complianceJobs';
const paths = new Set<string>();
function input() { const requestId = randomUUID(); paths.add(`contract_requests/${requestId}`); return declarationSchema.parse({ requestId, kind: 'cancel', language: 'en', name: 'Test Person', email: 'test@example.test', contract: 'Klar Plus' }); }
afterEach(async () => { vi.unstubAllEnvs(); for (const path of paths) await getDb().doc(path).delete(); paths.clear(); });
describe('contract declarations, confirmations and provider cancellation', { timeout: 20_000 }, () => {
  it('atomically accepts unauthenticated declarations once without disclosing contract existence', async () => {
    const data = input(); const receipts = await Promise.all([acceptDeclaration(getDb(), data), acceptDeclaration(getDb(), data)]);
    expect(receipts[0]).toEqual(receipts[1]); expect(receipts[0]!.text).toContain('earliest possible date');
    const stored = (await getDb().doc(`contract_requests/${data.requestId}`).get()).data()!;
    expect(stored).toMatchObject({ uid: null, processingStatus: 'review_required', mailStatus: 'pending' });
    await expect(acceptDeclaration(getDb(), { ...data, email: 'other@example.test' })).rejects.toThrow('request_conflict');
  });
  it('leaves an outage retryable and does not mark cancellation complete until Stripe confirms', async () => {
    const data = input(); const uid = 'contract-' + randomUUID(); paths.add(`users/${uid}`); paths.add(`subscriptions/${uid}`);
    await getDb().doc(`users/${uid}`).set({ subscriptionId: 'sub_test', stripeCustomerId: 'cus_test', plan: 'plus' });
    await getDb().doc(`subscriptions/${uid}`).set({ plan: 'plus', subscriptionId: 'sub_test', stripeCustomerId: 'cus_test', autoRenew: true });
    await acceptDeclaration(getDb(), data, uid);
    const stripe = { subscriptions: { retrieve: vi.fn(async () => ({ customer: 'cus_test', status: 'active', ended_at: null })),
      update: vi.fn().mockRejectedValueOnce(new Error('outage')).mockResolvedValueOnce({ cancel_at: 1_900_000_000 }) } };
    await expect(processContractCancellation(data.requestId, getDb(), stripe as any)).rejects.toThrow('outage');
    expect((await getDb().doc(`contract_requests/${data.requestId}`).get()).data()?.processingStatus).toBe('pending');
    await processContractCancellation(data.requestId, getDb(), stripe as any);
    expect(stripe.subscriptions.update).toHaveBeenLastCalledWith('sub_test', { cancel_at_period_end: true }, { idempotencyKey: `klar-cancel-${data.requestId}` });
    expect((await getDb().doc(`contract_requests/${data.requestId}`).get()).data()?.processingStatus).toBe('completed');
  });
  it('leases confirmation delivery across workers and keeps provider errors in the outbox', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'test-only-key'); vi.stubEnv('SENDGRID_FROM_EMAIL', 'sender@example.test');
    const data = input(); await acceptDeclaration(getDb(), data);
    const send = vi.fn(async () => new Response('', { status: 202 }));
    await Promise.all([deliverContractReceipt(data.requestId, getDb(), send), deliverContractReceipt(data.requestId, getDb(), send)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await getDb().doc(`contract_requests/${data.requestId}`).get()).data()?.mailStatus).toBe('accepted');
    const other = input(); await acceptDeclaration(getDb(), other);
    await deliverContractReceipt(other.requestId, getDb(), vi.fn(async () => new Response('', { status: 503 })));
    expect((await getDb().doc(`contract_requests/${other.requestId}`).get()).data()?.mailStatus).toBe('pending');
  });
});
