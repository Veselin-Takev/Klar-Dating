import { createHash, randomUUID } from 'node:crypto';
import { Router, urlencoded } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getDb } from './db';
import { getStripe } from './stripeService';
import { createRequestI18n } from '../i18n/server';
import { normalizeLanguage } from '../i18n/locale';

export const declarationSchema = z.object({
  requestId: z.string().uuid(), kind: z.enum(['cancel', 'withdraw']), language: z.enum(['de', 'en', 'es', 'fr']),
  name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(254),
  contract: z.string().trim().min(1).max(200), cancellationType: z.enum(['ordinary', 'extraordinary']).default('ordinary'),
  reason: z.string().trim().max(2000).default(''), requestedEnd: z.string().max(10).regex(/^(\d{4}-\d{2}-\d{2})?$/).default(''),
}).strict().refine(value => value.kind !== 'cancel' || value.cancellationType !== 'extraordinary' || !!value.reason, { message: 'reason_required' });
export type Declaration = z.infer<typeof declarationSchema>;
export class ContractError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

/** A declaration is accepted independently of account lookup, payment-provider availability and disputed deadlines. */
export interface CancellationContext {
  terminationAt?: Date | null;
}

function formatContractEnd(input: Declaration, context?: CancellationContext, earliestText = 'frühestmöglicher Zeitpunkt gemäß § 312k Abs. 5 BGB'): string {
  if (context?.terminationAt instanceof Date && !Number.isNaN(context.terminationAt.getTime())) return context.terminationAt.toISOString();
  if (input.requestedEnd) return `${input.requestedEnd}T23:59:59.999Z`;
  return earliestText;
}

export async function acceptDeclaration(db: Firestore, input: Declaration, authenticatedUid?: string, context?: CancellationContext) {
  const ref = db.doc(`contract_requests/${input.requestId}`);
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, uid: authenticatedUid ?? null })).digest('hex');
  return db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.fingerprint !== fingerprint) throw new ContractError(409, 'request_conflict');
      return existing.data()!.receipt as { id: string; receivedAt: string; text: string };
    }
    if (authenticatedUid && input.kind === 'cancel') {
      const subscriptionRef = db.doc(`subscriptions/${authenticatedUid}`);
      const subscription = await tx.get(subscriptionRef);
      const subscriptionData = subscription.data() ?? {};
      if (subscriptionData.plan !== 'plus') throw new ContractError(409, 'no_active_subscription');
      const activeRequestId = typeof subscriptionData.cancellationRequestId === 'string' ? subscriptionData.cancellationRequestId : null;
      if (activeRequestId && subscriptionData.cancellationStatus && subscriptionData.cancellationStatus !== 'failed') {
        const activeRequest = await tx.get(db.doc(`contract_requests/${activeRequestId}`));
        const activeReceipt = activeRequest.data()?.receipt;
        if (activeReceipt) return activeReceipt as { id: string; receivedAt: string; text: string };
        throw new ContractError(409, 'cancellation_already_pending');
      }
    }
    const receivedAt = new Date().toISOString(); const { t } = createRequestI18n(input.language);
    const text = [t('contracts.receipt'), t(input.kind === 'cancel' ? 'contracts.cancelDeclaration' : 'contracts.withdrawDeclaration'),
      `${t('contracts.reference')}: ${input.requestId}`, `${t('contracts.receivedAt')}: ${receivedAt}`,
      `${t('contracts.name')}: ${input.name}`, `${t('contracts.email')}: ${input.email}`, `${t('contracts.contract')}: ${input.contract}`,
      ...(input.kind === 'cancel' ? [`${t('contracts.cancellationType')}: ${t(input.cancellationType === 'ordinary' ? 'contracts.ordinary' : 'contracts.extraordinary')}`,
        `${t('contracts.termination')}: ${formatContractEnd(input, context, t('contracts.earliest'))}`] : []),
      `${t('contracts.reason')}: ${input.reason}`, t('contracts.receiptNote')].join('\n');
    const receipt = { id: input.requestId, receivedAt, text };
    tx.create(ref, { ...input, uid: authenticatedUid ?? null, fingerprint, receipt,
      terminationAt: context?.terminationAt ?? null,
      processingStatus: authenticatedUid && input.cancellationType === 'ordinary' ? 'pending' : 'review_required',
      processingNextAttemptAt: authenticatedUid && input.cancellationType === 'ordinary' ? new Date(receivedAt) : new Date('9999-01-01'),
      mailStatus: 'pending', mailNextAttemptAt: new Date(receivedAt), createdAt: new Date(receivedAt), attempts: 0 });
    if (authenticatedUid && input.kind === 'cancel' && input.cancellationType === 'ordinary') {
      const subscriptionRef = db.doc(`subscriptions/${authenticatedUid}`);
      tx.set(subscriptionRef, { autoRenew: false, cancellationStatus: 'pending', cancellationRequestId: receipt.id }, { merge: true });
      tx.set(db.doc(`subscription_events/${receipt.id}`), {
        type: 'cancellation', uid: authenticatedUid, requestId: receipt.id, status: 'pending',
        receivedAt: new Date(receivedAt), effectiveAt: context?.terminationAt ?? null, createdAt: new Date(receivedAt),
      });
    }
    return receipt;
  });
}

/** Provider cancellation is retryable; no local success flag can substitute for it. */
const CONTRACT_PROCESSING_LEASE_MS = 5 * 60_000;

function timestampMs(value: unknown): number {
  if (typeof (value as { toMillis?: () => number } | null)?.toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : 0;
}

export async function processContractCancellation(id: string, db: Firestore = getDb(), stripe = getStripe()) {
  const ref = db.doc(`contract_requests/${id}`); const now = Date.now(); const lease = randomUUID();
  const job = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref); const data = snapshot.data();
    if (!data || data.processingStatus !== 'pending' || !data.uid) return null;
    if (timestampMs(data.processingLeaseUntil) > now) return null;
    tx.update(ref, { processingLease: lease, processingLeaseUntil: now + CONTRACT_PROCESSING_LEASE_MS });
    return data;
  });
  if (!job) return;
  try {
    const user = (await db.doc(`users/${job.uid}`).get()).data();
    if (!user?.subscriptionId) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.processingLease !== lease) return;
        tx.update(ref, { processingStatus: 'review_required', processingNextAttemptAt: new Date('9999-01-01'), processingLease: null, processingLeaseUntil: 0 });
      });
      return;
    }
    const subscriptionId = user.subscriptionId as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    if (customerId !== user.stripeCustomerId) throw new ContractError(409, 'contract_mismatch');
    let effectiveAt: number | null = subscription.ended_at;
    if (subscription.status !== 'canceled') {
      if (job.kind === 'cancel') {
        const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true }, { idempotencyKey: `klar-cancel-${id}` });
        effectiveAt = updated.cancel_at ?? null;
      } else {
        const cancelled = await stripe.subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false }, { idempotencyKey: `klar-withdraw-${id}` });
        effectiveAt = cancelled.ended_at;
      }
    }
    await db.runTransaction(async tx => {
      const [current, request] = await Promise.all([tx.get(db.doc(`users/${job.uid}`)), tx.get(ref)]);
      if (request.data()?.processingLease !== lease) return;
      tx.update(ref, { processingStatus: 'completed', subscriptionId, effectiveAt,
        terminationAt: effectiveAt ? new Date(effectiveAt * 1000) : null,
        processingNextAttemptAt: new Date('9999-01-01'), processingLease: null, processingLeaseUntil: 0,
        refundStatus: job.kind === 'withdraw' ? 'review_required' : 'not_applicable', completedAt: new Date() });
      tx.set(db.doc(`subscriptions/${job.uid}`), { autoRenew: false, cancellationStatus: 'completed', cancelledAt: new Date(),
        paidUntil: effectiveAt ? new Date(effectiveAt * 1000) : null }, { merge: true });
      if (job.kind === 'cancel') {
        tx.set(db.doc(`subscription_events/${id}`), {
          type: 'cancellation', uid: job.uid, requestId: id, status: 'completed',
          receivedAt: job.receivedAt ?? new Date(), effectiveAt: effectiveAt ? new Date(effectiveAt * 1000) : null,
          createdAt: new Date(),
        }, { merge: true });
      }
      if (job.kind === 'withdraw' && current.exists && current.data()?.subscriptionId === subscriptionId) tx.update(current.ref, { plan: 'free', subscriptionId: null });
      if (job.kind === 'withdraw') {
        tx.set(db.doc(`processed_stripe_events/subscription_${subscriptionId}`), { cancelled: true, receivedAt: new Date() });
        tx.set(db.doc(`refund_queue/${id}`), {
          requestId: id,
          subscriptionId,
          grund: 'widerruf',
          status: 'review_required',
          createdAt: new Date(),
          dueAt: new Date(Date.now() + 14 * 24 * 60 * 60_000),
          attempts: 0,
        }, { merge: false });
      }
    });
  } catch (error) {
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.processingLease !== lease) return;
      tx.update(ref, { processingLease: null, processingLeaseUntil: 0 });
    }).catch(() => {});
    throw error;
  }
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
function page(language: string, title: string, content: string) {
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · Klar</title><link rel="stylesheet" href="/contracts.css"></head><body><main><h1>${escape(title)}</h1>${content}</main></body></html>`;
}
export function createPublicContractsRouter(db: () => Firestore = getDb) {
  const router = Router();
  router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }); next(); });
  router.get('/:action', (req, res) => {
    if (!['kuendigen', 'widerrufen'].includes(req.params.action)) return res.sendStatus(404);
    const kind = req.params.action === 'kuendigen' ? 'cancel' : 'withdraw';
    const language = normalizeLanguage(req.query.lang); const { t } = createRequestI18n(language);
    const title = t(kind === 'cancel' ? 'contracts.cancelLink' : 'contracts.withdrawLink');
    const field = (name: string, label: string, type: string, required: boolean, maxLength: number) => `<p><label for="${name}">${escape(label)}</label><br><input id="${name}" name="${name}" type="${type}" maxlength="${maxLength}" ${required ? 'required' : ''}></p>`;
    return res.type('html').send(page(language, title,
      `<nav aria-label="${escape(t('settings.language'))}">${['de', 'en', 'es', 'fr'].map(lang => `<a href="?lang=${lang}" lang="${lang}">${lang.toUpperCase()}</a>`).join(' · ')}</nav><p>${escape(t('contracts.intro'))}</p>` +
      `<form method="post" action="/vertraege/erklaerung"><input type="hidden" name="requestId" value="${randomUUID()}"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="language" value="${language}">` +
      field('name', t('contracts.name'), 'text', true, 200) + field('email', t('contracts.email'), 'email', true, 254) + field('contract', t('contracts.contract'), 'text', true, 200) +
      (kind === 'cancel' ? `<p><label for="cancellationType">${escape(t('contracts.cancellationType'))}</label><br><select id="cancellationType" name="cancellationType"><option value="ordinary">${escape(t('contracts.ordinary'))}</option><option value="extraordinary">${escape(t('contracts.extraordinary'))}</option></select></p>` + field('requestedEnd', t('contracts.requestedEnd'), 'date', false, 10) + `<p>${escape(t('contracts.earliest'))}</p>` : '') +
      `<p><label for="reason">${escape(t('contracts.reason'))}</label><br><textarea id="reason" name="reason" maxlength="2000"></textarea></p>` +
      `<button type="submit">${escape(t(kind === 'cancel' ? 'contracts.confirmCancel' : 'contracts.confirmWithdraw'))}</button></form>`));
  });
  router.post('/erklaerung', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    const language = normalizeLanguage(req.body?.language); const { t } = createRequestI18n(language);
    const input = declarationSchema.safeParse(req.body);
    if (!input.success) return res.status(400).type('html').send(page(language, t('contracts.error'), `<p role="alert">${escape(t('contracts.invalid'))}</p><p>${escape(t('contracts.back'))}</p>`));
    try {
      const receipt = await acceptDeclaration(db(), input.data);
      const { deliverContractReceipt } = await import('./complianceJobs');
      // A mail outage cannot revoke the already persisted declaration; the scheduler retries.
      try { await deliverContractReceipt(receipt.id, db()); } catch { /* Durable pending outbox. */ }
      return res.type('html').send(page(language, t('contracts.receipt'), `<p>${escape(t('contracts.receiptNote'))}</p><pre>${escape(receipt.text)}</pre><a download="Klar-${receipt.id}.txt" href="data:text/plain;charset=utf-8,${encodeURIComponent(receipt.text)}">${escape(t('contracts.download'))}</a>`));
    } catch (error) {
      return res.status(error instanceof ContractError ? error.status : 503).type('html').send(page(language, t('contracts.error'), `<p role="alert">${escape(t('contracts.unavailable'))}</p>`));
    }
  });
  return router;
}
