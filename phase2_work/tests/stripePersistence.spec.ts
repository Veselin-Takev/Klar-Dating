// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { getStripe, handleStripeWebhook } from '../src/server/stripeService';

const docs = new Set<string>();
const secret = 'whsec_emulator_test_only';
function signedEvent(type: string, object: Record<string, unknown>, id = 'evt_' + randomUUID()) {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_emulator'); vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  docs.add('processed_stripe_events/' + id);
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  return { body: Buffer.from(payload), signature: getStripe().webhooks.generateTestHeaderString({ payload, secret }) };
}
async function send(type: string, object: Record<string, unknown>) {
  const event = signedEvent(type, object); return handleStripeWebhook(event.body, event.signature);
}
async function userPlan(uid: string): Promise<unknown> {
  const data = (await getDb().doc('users/' + uid).get()).data();
  if (!data) throw new Error('Expected persisted user profile.');
  return data.plan;
}

async function setup() {
  const uid = 'stripe-' + randomUUID(); const subscription = 'sub_' + randomUUID();
  docs.add('users/' + uid); docs.add('processed_stripe_events/subscription_' + subscription);
  await getDb().collection('users').doc(uid).set({ plan: 'free' });
  return { uid, subscription, session: { mode: 'subscription', payment_status: 'paid', currency: 'eur', amount_total: 1199, metadata: { klarUserId: uid }, client_reference_id: uid, subscription, customer: 'cus_test' } };
}
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  for (const path of docs) await getDb().doc(path).delete(); docs.clear();
});
describe('signed payment webhooks with real Firestore', { timeout: 20000 }, () => {
  it('commits entitlement and receipt once under concurrent delivery', async () => {
    const { uid, session } = await setup(); const event = signedEvent('checkout.session.completed', session);
    const result = await Promise.all([handleStripeWebhook(event.body, event.signature), handleStripeWebhook(event.body, event.signature)]);
    expect(result.filter(r => r.duplicate)).toHaveLength(1);
    const user = (await getDb().doc('users/' + uid).get()).data();
    if (!user) throw new Error('Expected persisted user entitlement.');
    expect(user.plan).toBe('plus');
  });
  it('keeps a failed commit retryable instead of losing fulfillment', async () => {
    const { uid, session } = await setup(); const event = signedEvent('checkout.session.completed', session);
    const fail = vi.spyOn(getDb(), 'runTransaction').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(handleStripeWebhook(event.body, event.signature)).rejects.toThrow('database unavailable');
    fail.mockRestore();
    expect(await handleStripeWebhook(event.body, event.signature)).toMatchObject({ duplicate: false, applied: true });
    const user = (await getDb().doc('users/' + uid).get()).data();
    if (!user) throw new Error('Expected persisted user entitlement.');
    expect(user.plan).toBe('plus');
  });
  it('does not grant unpaid/wrong-product sessions or recreate deleted profiles', async () => {
    const { uid, session } = await setup();
    for (const change of [{ payment_status: 'unpaid' }, { mode: 'payment' }, { amount_total: 1 }, { currency: 'usd' }, { client_reference_id: 'other' }]) {
      expect(await send('checkout.session.completed', { ...session, ...change })).toMatchObject({ applied: false });
    }
    const user = (await getDb().doc('users/' + uid).get()).data();
    if (!user) throw new Error('Expected persisted user profile.');
    expect(user.plan).toBe('free');
    await getDb().doc('users/' + uid).delete();
    expect(await send('checkout.session.completed', session)).toMatchObject({ applied: false });
    expect((await getDb().doc('users/' + uid).get()).exists).toBe(false);
  });
  it('handles cancellation before completion without reactivating the subscription', async () => {
    const { uid, subscription, session } = await setup();
    await send('customer.subscription.deleted', { id: subscription });
    expect(await send('checkout.session.completed', session)).toMatchObject({ applied: false });
    expect(await userPlan(uid)).toBe('free');
  });
  it('persists a terminal cancellation tombstone even before local subscription linkage exists', async () => {
    const { uid, subscription, session } = await setup();
    await send('customer.subscription.deleted', { id: subscription });
    expect((await getDb().doc(`processed_stripe_events/subscription_${subscription}`).get()).exists).toBe(true);
    expect(await send('customer.subscription.updated', { id: subscription, status: 'active', cancel_at_period_end: false })).toMatchObject({ applied: false });
    expect(await send('checkout.session.completed', session)).toMatchObject({ applied: false });
    expect((await getDb().doc('users/' + uid).get()).data().plan).toBe('free');
  });
  it('revokes a completed subscription and rejects tampered signatures before writes', async () => {
    const { uid, subscription, session } = await setup();
    await send('checkout.session.async_payment_succeeded', session);
    await send('customer.subscription.deleted', { id: subscription });
    expect((await getDb().doc('users/' + uid).get()).data().plan).toBe('free');
    const event = signedEvent('checkout.session.completed', session);
    await expect(handleStripeWebhook(Buffer.from('{}'), event.signature)).rejects.toThrow();
  });
});
