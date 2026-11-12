import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
export type PaymentRepository = Pick<ReturnType<typeof getServiceRepository>, 'transaction'>;
const record = z.record(z.string(), z.unknown());

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is required');
    stripeClient = new Stripe(key, { apiVersion: '2026-08-26.dahlia', timeout: 10_000, maxNetworkRetries: 1 });
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

function epochMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const millis: unknown = value.toMillis();
    if (typeof millis === 'number' && Number.isFinite(millis)) return millis;
  }
  return 0;
}

export async function reserveCheckout(userId: string, repo: PaymentRepository = getServiceRepository('payments'), now = Date.now()) {
  return repo.transaction(async tx => {
    const [user, subscription] = await Promise.all([tx.read(`users/${userId}`, record), tx.read(`subscriptions/${userId}`, record)]);
    if (!user) throw new Error('checkout_user_not_found');
    const data = subscription ?? {};
    if (user.plan === 'plus' || data.plan === 'plus') throw new CheckoutConflictError('subscription_exists');
    if (epochMillis(data.checkoutLeaseUntil) > now || (data.checkoutStatus === 'created' && epochMillis(data.checkoutExpiresAt) > now)) throw new CheckoutConflictError('checkout_in_progress');
    const requestId = typeof data.checkoutRequestId === 'string' && data.checkoutRequestId ? data.checkoutRequestId : randomUUID();
    tx.write(`subscriptions/${userId}`, record, {checkoutRequestId:requestId, checkoutLeaseUntil:new Date(now + CHECKOUT_LEASE_MS), checkoutExpiresAt:null, checkoutStatus:'creating'}, {merge:true});
    return requestId;
  });
}

async function finalizeCheckoutReservation(userId: string, requestId: string, sessionId: string | null, repo: PaymentRepository) {
  await repo.transaction(async tx => {
    const path = `subscriptions/${userId}`, data = await tx.read(path, record);
    if (data?.checkoutRequestId !== requestId) return;
    tx.write(path, record, {checkoutLeaseUntil:null, checkoutExpiresAt: sessionId ? new Date(Date.now()+CHECKOUT_SESSION_GUARD_MS) : null, checkoutStatus:sessionId?'created':'failed', checkoutSessionId:sessionId}, {merge:true});
  });
}

export async function createCheckoutSession(userId: string, returnUrl: string, repo: PaymentRepository = getServiceRepository('payments'), stripe = getStripe()) {
  const safeReturnUrl = validateReturnUrl(returnUrl);
  const requestId = await reserveCheckout(userId, repo);
  const success = new URL(safeReturnUrl), successHash = success.hash;
  success.hash = ''; success.searchParams.delete('session_id');
  const successUrl = success.toString()+(success.search?'&':'?')+'session_id={CHECKOUT_SESSION_ID}'+successHash;
  const cancel = new URL(safeReturnUrl); cancel.searchParams.set('cancel','true');
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card','paypal'], mode:'subscription', client_reference_id:userId,
      metadata:{klarCheckoutRequestId:requestId,klarUserId:userId,klarTenantId:'default'},
      subscription_data:{metadata:{klarUserId:userId,klarTenantId:'default'}},
      line_items:[{price_data:{currency:'eur', product_data:{name:'Klar+ Abonnement',description:'Klar+ Abonnement.'}, unit_amount:1199, recurring:{interval:'month'}},quantity:1}],
      success_url:successUrl, cancel_url:cancel.toString(),
    }, {idempotencyKey:`klar-checkout-${requestId}`});
    await finalizeCheckoutReservation(userId,requestId,session.id??null,repo);
    return session.url;
  } catch (error) {
    await finalizeCheckoutReservation(userId,requestId,null,repo).catch(()=>{});
    throw error;
  }
}

export async function handleStripeWebhook(body: Buffer, signature: string) {
  const stripe = getStripe(), secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');
  if (!signature) throw new Error('Missing Stripe signature');
  const event = stripe.webhooks.constructEvent(body,signature,secret);
  return applyStripeEvent(event, getServiceRepository('payments'));
}

function isStripeEventNewer(data: Record<string, unknown>, event: Stripe.Event) {
  return event.created >= (typeof data.lastStripeEventCreated==='number'? data.lastStripeEventCreated:0);
}

async function applyStripeEvent(event: Stripe.Event, repo: PaymentRepository) {
  const object = event.data.object as unknown as Record<string, unknown>;
  const metadata = object.metadata;
  const tenant = metadata && typeof metadata === 'object' ? (metadata as Record<string,unknown>).klarTenantId : undefined;
  return repo.transaction(async tx => {
    const eventRef = `processed_stripe_events/${event.id}`;
    if (await tx.read(eventRef,record)) return {received:true,duplicate:true};
    let applied = false;
    if (tenant !== undefined && tenant !== 'default') {
      tx.create(eventRef,record,{type:event.type,applied:false,receivedAt:FieldValue.serverTimestamp()});
      return {received:true,duplicate:false,applied:false};
    }
    if (event.type==='checkout.session.completed' || event.type==='checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.klarUserId ?? session.client_reference_id;
      const subscriptionId = typeof session.subscription==='string'?session.subscription:session.subscription?.id;
      if (session.metadata?.klarTenantId==='default' && session.mode==='subscription' && session.payment_status==='paid' && session.currency==='eur' && session.amount_total===1199
          && userId && !userId.includes('/') && subscriptionId && (!session.client_reference_id || session.client_reference_id===userId)) {
        const [user,cancellation,deletion,local] = await Promise.all([
          tx.read(`users/${userId}`,record), tx.read(`processed_stripe_events/subscription_${subscriptionId}`,record),
          tx.read(`account_deletions/${userId}`,record), tx.read(`subscriptions/${userId}`,record),
        ]);
        if (user && !cancellation && !deletion && isStripeEventNewer(local??{},event)) {
          const customerId = typeof session.customer==='string'?session.customer:session.customer?.id??null;
          tx.write(`users/${userId}`,record,{plan:'plus',subscriptionId,stripeCustomerId:customerId},{merge:true});
          tx.write(`subscriptions/${userId}`,record,{plan:'plus',autoRenew:true,startedAt:FieldValue.serverTimestamp(),billingStatus:'active',lastStripeEventCreated:event.created,subscriptionId,stripeCustomerId:customerId,checkoutStatus:'completed',checkoutExpiresAt:null,checkoutLeaseUntil:null,checkoutSessionId:session.id},{merge:true});
          applied=true;
        }
      }
    } else if (event.type==='checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session, userId = session.metadata?.klarUserId ?? session.client_reference_id;
      if (session.metadata?.klarTenantId==='default' && userId && !userId.includes('/')) {
        const path=`subscriptions/${userId}`, data=await tx.read(path,record);
        if (data?.checkoutSessionId===session.id && data.checkoutStatus==='created') {
          tx.write(path,record,{checkoutStatus:'expired',checkoutExpiresAt:null,checkoutLeaseUntil:null},{merge:true}); applied=true;
        }
      }
    } else if (event.type==='invoice.payment_failed' || event.type==='customer.subscription.updated' || event.type==='customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const invoice = event.data.object as unknown as {subscription?:string|{id:string}|null};
      const subscriptionId = event.type==='invoice.payment_failed' ? (typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id) : subscription.id;
      if (subscriptionId) {
        const cancellationRef=`processed_stripe_events/subscription_${subscriptionId}`;
        const cancellation=await tx.read(cancellationRef,record);
        if (!cancellation) {
          const users=await tx.list('users',record,{where:['subscriptionId','==',subscriptionId],limit:2});
          if (users.length>1) throw new Error('ambiguous_subscription_owner');
          // Every local read completes before any write, even on malformed duplicate ownership.
          const states=await Promise.all(users.map(user=>tx.read(`subscriptions/${user.id}`,record)));
          for (let i=0;i<users.length;i++) {
            const user=users[i]; if (!user || !isStripeEventNewer(states[i]??{},event)) continue;
            if (event.type==='invoice.payment_failed') {
              const patch={billingStatus:'past_due',lastPaymentFailureAt:FieldValue.serverTimestamp(),lastStripeEventCreated:event.created};
              tx.write(`users/${user.id}`,record,patch,{merge:true}); tx.write(`subscriptions/${user.id}`,record,patch,{merge:true});
            } else if (event.type==='customer.subscription.updated') {
              const billingStatus=['active','past_due','unpaid','canceled'].includes(subscription.status)?subscription.status:'incomplete';
              tx.write(`users/${user.id}`,record,{billingStatus,lastStripeEventCreated:event.created},{merge:true});
              tx.write(`subscriptions/${user.id}`,record,{plan:subscription.status==='canceled'?'frei':'plus',billingStatus,subscriptionId:subscription.id,autoRenew:!subscription.cancel_at_period_end,lastStripeEventCreated:event.created},{merge:true});
            } else {
              tx.write(`users/${user.id}`,record,{plan:'free',subscriptionId:null,billingStatus:'canceled',lastStripeEventCreated:event.created},{merge:true});
              tx.write(`subscriptions/${user.id}`,record,{plan:'frei',autoRenew:false,subscriptionId:null,billingStatus:'canceled',lastStripeEventCreated:event.created,cancelledAt:FieldValue.serverTimestamp()},{merge:true});
            }
            applied=true;
          }
          // Durable terminal tombstone even before any local user references this subscription.
          if (event.type==='customer.subscription.deleted') tx.create(cancellationRef,record,{cancelled:true,receivedAt:FieldValue.serverTimestamp(),eventCreated:event.created});
        }
      }
    }
    tx.create(eventRef,record,{type:event.type,applied,receivedAt:FieldValue.serverTimestamp()});
    return {received:true,duplicate:false,applied};
  });
}
