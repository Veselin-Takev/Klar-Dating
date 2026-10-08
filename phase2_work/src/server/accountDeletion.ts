import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getDb, runObservedTransaction } from './db';
import { getStripe } from './stripeService';
import { purgeAccountData } from './trustAndSafety';

const DIDIT_RESPONSE_MAX_BYTES = 64 * 1024;

async function readDiditJson(response: Response): Promise<unknown> {
  const announcedLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(announcedLength) && announcedLength > DIDIT_RESPONSE_MAX_BYTES) throw new Error('didit_response_too_large');
  const body = await response.arrayBuffer();
  if (body.byteLength > DIDIT_RESPONSE_MAX_BYTES) throw new Error('didit_response_too_large');
  return JSON.parse(Buffer.from(body).toString('utf8'));
}

async function ignoreMissing(action: () => Promise<unknown>) {
  try { await action(); } catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
}
export async function requestAccountDeletion(uid: string, db: Firestore = getDb()) {
  const ref = db.doc(`account_deletions/${uid}`);
  const result = await runObservedTransaction(db, 'accountDeletion.requestAccountDeletion', async tx => {
    const [existing, user, kyc] = await tx.getAll(ref, db.doc(`users/${uid}`), db.doc(`kyc_accounts/${uid}`));
    if (existing!.exists) return { requestId: existing!.data()!.requestId as string };
    const requestId = randomUUID();
    tx.create(ref, { requestId, status: 'pending', phase: 'purge', createdAt: new Date(), nextAttemptAt: new Date(),
      leaseUntil: 0, attempts: 0, hasDidit: kyc!.exists,
      subscriptionId: user!.data()?.subscriptionId ?? null, customerId: user!.data()?.stripeCustomerId ?? null });
    // Remove discoverability at the same instant the durable write barrier appears.
    tx.delete(db.doc(`public_profiles/${uid}`));
    if (user!.exists) tx.update(user!.ref, { isVerified: false });
    return { requestId };
  });
  await ignoreMissing(() => getAuth().updateUser(uid, { disabled: true }));
  await ignoreMissing(() => getAuth().revokeRefreshTokens(uid));
  return result;
}

/** Delete a bounded provider page, always from the first page because rows disappear. */
export async function eraseDiditPage(uid: string, _requestId: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!apiKey) throw new Error('didit_erasure_unavailable');
  const headers = { 'x-api-key': apiKey, 'content-type': 'application/json' };
  const call = async (url: string, init: RequestInit) => fetcher(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
  const listing = await call(`https://verification.didit.me/v3/sessions/?vendor_data=${encodeURIComponent(uid)}&session_kind=user&limit=5`, { method: 'GET' });
  if (!listing.ok) throw new Error('didit_erasure_unavailable');
  const page = z.object({ results: z.array(z.object({ session_id: z.string().uuid(), vendor_data: z.literal(uid) })).max(100) }).parse(await readDiditJson(listing));
  for (const session of page.results.slice(0, 5)) {
    const response = await call(`https://verification.didit.me/v3/session/${session.session_id}/delete/`, { method: 'DELETE' });
    if (response.status === 404) continue;
    if (response.status !== 204) throw new Error('didit_erasure_unavailable');
  }
  if (page.results.length) return false;
  const response = await call('https://verification.didit.me/v3/users/delete/', { method: 'POST', body: JSON.stringify({ vendor_data_list: [uid] }) });
  if (!response.ok) throw new Error('didit_erasure_unavailable');
  z.object({ deleted: z.number().int().min(0).max(1) }).parse(await readDiditJson(response));
  return true;
}

export type DeletionDependencies = {
  db: Firestore; now: () => number; disable: (uid: string) => Promise<void>; removeAuth: (uid: string) => Promise<void>;
  purge: (uid: string, requestId?: string) => Promise<unknown>; eraseProvider: (uid: string, requestId: string) => Promise<boolean>;
  cancelSubscription: (subscriptionId: string, customerId: string | null) => Promise<void>;
};
export function deletionDependencies(): DeletionDependencies {
  return { db: getDb(), now: Date.now, purge: purgeAccountData,
    disable: async uid => { await ignoreMissing(() => getAuth().updateUser(uid, { disabled: true })); await ignoreMissing(() => getAuth().revokeRefreshTokens(uid)); },
    removeAuth: uid => ignoreMissing(() => getAuth().deleteUser(uid)),
    eraseProvider: (uid, id) => eraseDiditPage(uid, id, process.env.DIDIT_API_KEY ?? ''),
    cancelSubscription: async (id, customerId) => {
      const stripe = getStripe(); const subscription = await stripe.subscriptions.retrieve(id);
      const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      if (customer !== customerId) throw new Error('subscription_owner_mismatch');
      if (subscription.status !== 'canceled') await stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false });
    },
  };
}

/** Leased durable job survives process restarts and provider/database failures. */
export async function runAccountDeletion(uid: string, deps = deletionDependencies()) {
  const ref = deps.db.doc(`account_deletions/${uid}`); const now = deps.now(); const lease = randomUUID();
  const job = await runObservedTransaction(deps.db, 'accountDeletion.acquireDeletionLease', async tx => {
    const snapshot = await tx.get(ref); const data = snapshot.data();
    const nextAttemptMs = typeof data?.nextAttemptAt?.toMillis === 'function'
      ? data.nextAttemptAt.toMillis()
      : typeof data?.nextAttemptAt?.getTime === 'function'
      ? data.nextAttemptAt.getTime()
      : (data?.nextAttemptAt ? new Date(data.nextAttemptAt).getTime() : 0);
    if (!data || data.status === 'completed' || data.leaseUntil > now || nextAttemptMs > now) return null;
    tx.update(ref, { lease, leaseUntil: now + 10 * 60_000, attempts: data.attempts + 1 }); return data;
  });
  if (!job) return;
  try {
    await deps.disable(uid);
    if (job.subscriptionId) await deps.cancelSubscription(job.subscriptionId, job.customerId);
    if (job.hasDidit && !await deps.eraseProvider(uid, job.requestId)) throw new Error('provider_more_pages');
    await deps.purge(uid, job.requestId);
    await deps.removeAuth(uid);
    // Old Storage ID tokens and requests already in flight can outlive revocation.
    // Final sweep only after the maximum token lifetime plus grace; never report completion early.
    await runObservedTransaction(deps.db, 'accountDeletion.finalizeDeletion', async tx => { const current = (await tx.get(ref)).data(); if (current?.lease !== lease) return; if (job.phase === 'purge') tx.update(ref, { phase: 'final_sweep', nextAttemptAt: new Date(now + 61 * 60_000), leaseUntil: 0, lastError: null });
      else tx.set(ref, { requestId: job.requestId, status: 'completed', completedAt: new Date(now), expiresAt: new Date(now + 30 * 86400_000), nextAttemptAt: new Date('9999-01-01'), leaseUntil: 0 }); });
  } catch {
    // No provider error bodies, email addresses, photos or raw identity data in logs/receipts.
    const attempts = typeof job.attempts === 'number' ? job.attempts : 0;
    const maxAttempts = 50;
    if (attempts >= maxAttempts) {
      await runObservedTransaction(deps.db, 'accountDeletion.markManualReview', async tx => { const current = (await tx.get(ref)).data(); if (current?.lease !== lease) return; tx.update(ref, { status: 'manual_review', lastError: 'retry_limit_reached', nextAttemptAt: new Date('9999-01-01'), leaseUntil: 0 }); });
    } else {
      const backoffMs = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts, 6));
      await runObservedTransaction(deps.db, 'accountDeletion.scheduleRetry', async tx => { const current = (await tx.get(ref)).data(); if (current?.lease !== lease) return; tx.update(ref, { lastError: 'retry_required', nextAttemptAt: new Date(now + backoffMs), leaseUntil: 0 }); });
    }
  }
}
