import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import type { Firestore } from 'firebase-admin/firestore';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is required');
    stripeClient = new Stripe(key, { apiVersion: '2026-08-26.dahlia' as unknown, timeout: 10_000, maxNetworkRetries: 1 });
  }
  return stripeClient;
}

function allowedReturnOrigins(): string[] {
  return (process.env.KLAR_ALLOWED_RETURN_ORIGINS ?? 'https://klar.app,https://www.klar.app')
    .split(',').map(v => v.trim()).filter(Boolean);
}

export function validateReturnUrl(returnUrl: string): string {
  let url: URL;
  try { url = new URL(returnUrl); } catch { throw new Error('Invalid returnUrl'); }
  if (url.username || url.password) throw new Error('returnUrl must not contain credentials');
  if (url.protocol !== 'https:') throw new Error('returnUrl must use HTTPS');
  const allowed = allowedReturnOrigins();
  if (!allowed.some(origin => {
    try { return new URL(origin).origin === url.origin; } catch { return false; }
  })) throw new Error('returnUrl origin is not allowed');
  return url.toString();
}

const CHECKOUT_LEASE_MS = 5 * 60_000;
const CHECKOUT_SESSION_GUARD_MS = 24 * 60 * 60_000;

export class CheckoutConflictError extends Error {
  readonly status = 409;
  constructor(readonly code: 'subscription_exists' | 'checkout_in_progress') {
    super(code);
  }
}

export async function reserveCheckout(userId: string, db: Firestore = getDb() as Firestore, now = Date.now()) {
  const userRef = db.collection('users').doc(userId);
  const subscriptionRef = db.collection('subscriptions').doc(userId);
  return db.runTransaction(async tx => {
    const [userSnap, subscriptionSnap] = await tx.getAll(userRef, subscriptionRef);
    const user = userSnap.data() ?? {};
    const subscription = subscriptionSnap.data() ?? {};
    if (user.plan === 'plus' || subscription.plan === 'plus') {
      throw new CheckoutConflictError('subscription_exists');
    }
    const leaseUntil = typeof subscription.checkoutLeaseUntil?.toMillis === 'function'
      ? subscription.checkoutLeaseUntil.toMillis()
      : subscription.checkoutLeaseUntil instanceof Date
        ? subscription.checkoutLeaseUntil.getTime()
        : typeof subscription.checkoutLeaseUntil === 'number' ? subscription.checkoutLeaseUntil : 0;
    const checkoutExpiresAt = typeof subscription.checkoutExpiresAt?.toMillis === 'function'
      ? subscription.checkoutExpiresAt.toMillis()
      : subscription.checkoutExpiresAt instanceof Date
        ? subscription.checkoutExpiresAt.getTime()
        : typeof subscription.checkoutExpiresAt === 'number' ? subscription.checkoutExpiresAt : 0;
    if (leaseUntil > now || (subscription.checkoutStatus === 'created' && checkoutExpiresAt > now)) {
      throw new CheckoutConflictError('checkout_in_progress');
    }
    const requestId = typeof subscription.checkoutRequestId === 'string' && subscription.checkoutRequestId.length > 0
      ? subscription.checkoutRequestId
      : randomUUID();
    tx.set(subscriptionRef, {
      checkoutRequestId: requestId,
      checkoutLeaseUntil: new Date(now + CHECKOUT_LEASE_MS),
      checkoutExpiresAt: null,
      checkoutStatus: 'creating',
    }, { merge: true });
    return requestId;
  });
}

async function finalizeCheckoutReservation(userId: string, requestId: string, sessionId: string | null, db: Firestore = getDb() as Firestore) {
  const ref = db.collection('subscriptions').doc(userId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    if (data.checkoutRequestId !== requestId) return;
    tx.set(ref, {
      checkoutLeaseUntil: null,
      checkoutExpiresAt: sessionId ? new Date(Date.now() + CHECKOUT_SESSION_GUARD_MS) : null,
      checkoutStatus: sessionId ? 'created' : 'failed',
      checkoutSessionId: sessionId,
    }, { merge: true });
  });
}

export async function createCheckoutSession(userId: string, returnUrl: string, db: Firestore = getDb() as Firestore, stripe = getStripe()) {
  const safeReturnUrl = validateReturnUrl(returnUrl);
  const requestId = await reserveCheckout(userId, db);
  const success = new URL(safeReturnUrl);
  success.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancel = new URL(safeReturnUrl);
  cancel.searchParams.set('cancel', 'true');
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal'],
      mode: 'subscription',
      client_reference_id: userId,
      metadata: { klarCheckoutRequestId: requestId, klarUserId: userId },
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Klar+ Abonnement', description: 'Maximale Klarheit, erweiterte Filter, keine Werbung.' },
          unit_amount: 1199,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: success.toString(),
      cancel_url: cancel.toString(),
    }, { idempotencyKey: `klar-checkout-${requestId}` });
    await finalizeCheckoutReservation(userId, requestId, session.id ?? null, db);
    return session.url;
  } catch (error) {
    await finalizeCheckoutReservation(userId, requestId, null, db).catch(() => {});
    throw error;
  }
}

export async function handleStripeWebhook(body: Buffer, signature: string) {
  const stripe = getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');
  if (!signature) throw new Error('Missing Stripe signature');
  const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  return applyStripeEvent(event);
}

/** Verified events only: completion marker and entitlement commit together. */
function isStripeEventNewer(data: Record<string, unknown>, event: Stripe.Event): boolean {
  const previous = typeof data.lastStripeEventCreated === 'number' ? data.lastStripeEventCreated : 0;
  return event.created >= previous;
}

async function applyStripeEvent(event: Stripe.Event) {
  const db: import('firebase-admin/firestore').Firestore = getDb();
  const eventRef = db.collection('processed_stripe_events').doc(event.id);
  return db.runTransaction(async (tx: import('firebase-admin/firestore').Transaction) => {
    if ((await tx.get(eventRef)).exists) return { received: true, duplicate: true };
    let applied = false;
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.klarUserId ?? session.client_reference_id;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      // This checkout sells exactly one EUR 11.99 monthly subscription, with no trial/discount.
      if (session.mode === 'subscription' && session.payment_status === 'paid' &&
          session.currency === 'eur' && session.amount_total === 1199 &&
          userId && !userId.includes('/') && subscriptionId &&
          (!session.client_reference_id || session.client_reference_id === userId)) {
        const userRef = db.collection('users').doc(userId);
        const cancellationRef = db.collection('processed_stripe_events').doc(`subscription_${subscriptionId}`);
        const [user, cancellation, deletion] = await tx.getAll(userRef, cancellationRef, db.doc(`account_deletions/${userId}`));
        // A cancellation can arrive before checkout; its durable tombstone prevents resurrection.
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const localSubscription = (await tx.get(subscriptionRef)).data() ?? {};
        if (user?.exists && !cancellation?.exists && !deletion?.exists && isStripeEventNewer(localSubscription, event)) {
          tx.update(userRef, { plan: 'plus', subscriptionId,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null });
          tx.set(subscriptionRef, {
            plan: 'plus',
            autoRenew: true,
            startedAt: FieldValue.serverTimestamp(),
            billingStatus: 'active',
            lastStripeEventCreated: event.created,
            subscriptionId,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
            checkoutStatus: 'completed', checkoutExpiresAt: null, checkoutLeaseUntil: null, checkoutSessionId: session.id,
          }, { merge: true });
          applied = true;
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.klarUserId ?? session.client_reference_id;
      if (userId && !userId.includes('/')) {
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const subscription = await tx.get(subscriptionRef);
        const data = subscription.data() ?? {};
        if (data.checkoutSessionId === session.id && data.checkoutStatus === 'created') {
          tx.set(subscriptionRef, { checkoutStatus: 'expired', checkoutExpiresAt: null, checkoutLeaseUntil: null }, { merge: true });
          applied = true;
        }
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) {
        const cancellation = await tx.get(db.collection('processed_stripe_events').doc(`subscription_${subscriptionId}`));
        if (!cancellation.exists) {
          const users = await tx.get(db.collection('users').where('subscriptionId', '==', subscriptionId));
          for (const user of users.docs) {
            const subscriptionRef = db.collection('subscriptions').doc(user.id);
            const local = (await tx.get(subscriptionRef)).data() ?? {};
            if (!isStripeEventNewer(local, event)) continue;
            tx.update(user.ref, {
              billingStatus: 'past_due',
              lastPaymentFailureAt: FieldValue.serverTimestamp(),
              lastStripeEventCreated: event.created,
            });
            tx.set(subscriptionRef, {
              billingStatus: 'past_due',
              lastPaymentFailureAt: FieldValue.serverTimestamp(),
              lastStripeEventCreated: event.created,
            }, { merge: true });
            applied = true;
          }
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const cancellation = await tx.get(db.collection('processed_stripe_events').doc(`subscription_${subscription.id}`));
      if (!cancellation.exists) {
        const users = await tx.get(db.collection('users').where('subscriptionId', '==', subscription.id));
        const billingStatus = subscription.status === 'active' ? 'active' :
          subscription.status === 'past_due' ? 'past_due' :
          subscription.status === 'unpaid' ? 'unpaid' :
          subscription.status === 'canceled' ? 'canceled' : 'incomplete';
        for (const user of users.docs) {
          const subscriptionRef = db.collection('subscriptions').doc(user.id);
          const local = (await tx.get(subscriptionRef)).data() ?? {};
          if (!isStripeEventNewer(local, event)) continue;
          tx.update(user.ref, { billingStatus, lastStripeEventCreated: event.created });
          tx.set(subscriptionRef, {
            plan: subscription.status === 'canceled' ? 'frei' : 'plus',
            billingStatus,
            subscriptionId: subscription.id,
            autoRenew: subscription.cancel_at_period_end ? false : true,
            lastStripeEventCreated: event.created,
          }, { merge: true });
          applied = true;
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const cancellationRef = db.collection('processed_stripe_events').doc(`subscription_${subscription.id}`);
      const alreadyCancelled = await tx.get(cancellationRef);
      if (!alreadyCancelled.exists) {
        const users = await tx.get(db.collection('users').where('subscriptionId', '==', subscription.id));
        for (const user of users.docs) {
          const subscriptionRef = db.collection('subscriptions').doc(user.id);
          const local = (await tx.get(subscriptionRef)).data() ?? {};
          if (!isStripeEventNewer(local, event)) continue;
          tx.update(user.ref, { plan: 'free', subscriptionId: null, billingStatus: 'canceled', lastStripeEventCreated: event.created });
          tx.set(subscriptionRef, { plan: 'frei', autoRenew: false, subscriptionId: null, billingStatus: 'canceled', lastStripeEventCreated: event.created, cancelledAt: FieldValue.serverTimestamp() }, { merge: true });
          applied = true;
        }
        // Durable terminal tombstone is written even when no local user currently
        // references the Stripe subscription, closing delivery-order races.
        tx.create(cancellationRef, { cancelled: true, receivedAt: FieldValue.serverTimestamp(), eventCreated: event.created });
      }
    }
    // No user identifier, payload or optional product analytics retained in this ledger.
    tx.create(eventRef, { type: event.type, applied, receivedAt: FieldValue.serverTimestamp() });
    return { received: true, duplicate: false, applied };
  });
}
