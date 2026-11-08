import { readBoundedResponse } from './boundedResponse';
import { emptyDeletionCounts, readDeletionCounts, buildDeletionAuditReceipt, deletionReceiptId } from './deletionAccounting';
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { getServiceRepository, scopeServiceDatabase } from './firestoreRepository/nativeDatabase';
import { timestampMillis } from '../../functions/src/firestoreRepository/runtimeSchemas';
import { getStripe } from './stripeService';
import { purgeAccountData } from './trustAndSafety';
import { DeletionPageComplete, DeletionTimeSliceComplete, DeletionProviderPageComplete, DeletionStoragePageComplete } from './deletionProgress';

const deletionRecord = z.object({requestId:z.string().optional(), status:z.string().optional(), lease:z.string().optional(), leaseUntil:z.number().optional(), attempts:z.number().int().nonnegative().optional(), phase:z.string().optional(), hasDidit:z.boolean().optional(), subscriptionId:z.string().nullable().optional(), customerId:z.string().nullable().optional(), stripeCustomerId:z.string().nullable().optional(), completedPages:z.number().optional(), completedProviderPages:z.number().optional(), completedStoragePages:z.number().optional(), completedSlices:z.number().optional()}).passthrough();
const DIDIT_RESPONSE_MAX_BYTES = 64 * 1024;

async function readDiditJson(response: Response): Promise<unknown> {
  const body = await readBoundedResponse(response, DIDIT_RESPONSE_MAX_BYTES, 'didit_response_too_large');
  return JSON.parse(Buffer.from(body).toString('utf8'));
}

async function ignoreMissing(action: () => Promise<unknown>) {
  try { await action(); } catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
}

/**
 * Auth deletion is a destructive security boundary. Do not mark the durable
 * deletion workflow complete until the provider postcondition is observable.
 * A bounded retry handles transient provider propagation while persistent
 * failure leaves the durable job retryable instead of falsely reporting completion.
 */
async function removeAuthAndVerify(uid: string): Promise<void> {
  const auth = getAuth();
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return;
      lastError = error;
    }

    try {
      await auth.getUser(uid);
      lastError = new Error('auth_deletion_not_confirmed');
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return;
      lastError = error;
    }

    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 100 * (2 ** attempt)));
  }
  throw lastError instanceof Error ? lastError : new Error('auth_deletion_not_confirmed');
}
export async function requestAccountDeletion(uid: string, database: Firestore | TenantAwareFirestoreRepository = getServiceRepository('auth')) {
  const db = scopeServiceDatabase(database, 'auth');
  const ref = `account_deletions/${uid}`;
  const result = await db.transaction(async tx => {
    const [existing, user, kyc] = await Promise.all([tx.read(ref, deletionRecord), tx.read(`users/${uid}`, deletionRecord), tx.read(`kyc_accounts/${uid}`, deletionRecord)]);
    // The Rules-visible fence and durable deletion job share one Firestore
    // commit. Repeated requests also repair the fence for legacy pending jobs.
    if (user !== null) tx.write(`users/${uid}`, deletionRecord, { isVerified: false, mediaAccessState: 'erasing' }, { merge: true });
    if (existing !== null) return { requestId: existing.requestId! };
    const requestId = randomUUID();
    tx.create(ref, deletionRecord, { requestId, status: 'pending', phase: 'purge', createdAt: new Date(), nextAttemptAt: new Date(),
      leaseUntil: 0, attempts: 0, accountingVersion: 2, deletedCounts: emptyDeletionCounts(), hasDidit: kyc !== null,
      subscriptionId: user?.subscriptionId ?? null, customerId: user?.stripeCustomerId ?? null });
    // Remove discoverability at the same instant the durable write barrier appears.
    tx.delete(`public_profiles/${uid}`);
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
  let deleted = 0;
  for (const session of page.results.slice(0, 5)) {
    const response = await call(`https://verification.didit.me/v3/session/${session.session_id}/delete/`, { method: 'DELETE' });
    if (response.status === 404) continue;
    if (response.status !== 204) throw new Error('didit_erasure_unavailable');
    deleted++;
  }
  if (page.results.length) {
    // A stale listing returning only 404s must not grant unlimited free retries.
    if (!deleted) throw new Error('didit_erasure_no_progress');
    return false;
  }
  const response = await call('https://verification.didit.me/v3/users/delete/', { method: 'POST', body: JSON.stringify({ vendor_data_list: [uid] }) });
  if (!response.ok) throw new Error('didit_erasure_unavailable');
  z.object({ deleted: z.number().int().min(0).max(1) }).parse(await readDiditJson(response));
  return true;
}

export type DeletionDependencies = {
  repository: TenantAwareFirestoreRepository; now: () => number; disable: (uid: string) => Promise<void>; removeAuth: (uid: string) => Promise<void>;
  purge: (uid: string, requestId: string, lease?: string) => Promise<unknown>; eraseProvider: (uid: string, requestId: string) => Promise<boolean>;
  cancelSubscription: (subscriptionId: string, customerId: string | null) => Promise<void>;
};
export function deletionDependencies(): DeletionDependencies {
  return { repository: getServiceRepository('auth'), now: Date.now, purge: purgeAccountData,
    disable: async uid => { await ignoreMissing(() => getAuth().updateUser(uid, { disabled: true })); await ignoreMissing(() => getAuth().revokeRefreshTokens(uid)); },
    removeAuth: removeAuthAndVerify,
    eraseProvider: (uid, id) => eraseDiditPage(uid, id, process.env.DIDIT_API_KEY ?? ''),
    cancelSubscription: async (id, customerId) => {
      const stripe = getStripe(); const subscription = await stripe.subscriptions.retrieve(id);
      const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      if (subscription.metadata?.klarTenantId !== 'default' || customer !== customerId) throw new Error('subscription_owner_mismatch');
      if (subscription.status !== 'canceled') await stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false });
    },
  };
}

/** Leased durable job survives process restarts and provider/database failures. */
export async function runAccountDeletion(uid: string, deps = deletionDependencies()) {
  const ref = `account_deletions/${uid}`; const now = deps.now(); const lease = randomUUID();
  const job = await deps.repository.transaction(async tx => {
    const data = await tx.read(ref, deletionRecord);
    const nextAttemptMs = timestampMillis(data?.nextAttemptAt) || 0;
    if (!data || data.status !== 'pending' || (data.leaseUntil ?? 0) > now || nextAttemptMs > now) return null;
    try { readDeletionCounts(data); z.string().min(1).max(128).parse(data.requestId); if (!['purge','final_sweep'].includes(data.phase ?? '')) throw new Error('deletion_phase_invalid'); } catch {
      tx.write(ref, deletionRecord, { status: 'manual_review', lastError: 'accounting_migration_required', leaseUntil: 0 }, { merge: true });
      return null;
    }
    tx.write(ref, deletionRecord, { lease, leaseUntil: now + 10 * 60_000, attempts: (data.attempts ?? 0) + 1 }, { merge: true }); return data;
  });
  if (!job) return;
  try {
    await deps.disable(uid);
    if (job.subscriptionId) await deps.cancelSubscription(job.subscriptionId, job.customerId ?? null);
    if (job.hasDidit && !await deps.eraseProvider(uid, job.requestId!)) throw new DeletionProviderPageComplete();
    await deps.purge(uid, job.requestId!, lease);
    // Provider deletion is irreversible. Re-read the authoritative job state
    // immediately before the provider boundary so a worker that lost its lease
    // cannot perform the final destructive identity deletion.
    const activeJobRef = ref;
    const leaseStillOwned = await deps.repository.transaction(async tx => {
      const current = await tx.read(activeJobRef, deletionRecord);
      return current?.status === 'pending' && current?.lease === lease && (current.leaseUntil ?? 0) > deps.now();
    });
    if (!leaseStillOwned) throw new Error('deletion_lease_lost');
    await deps.removeAuth(uid);
    // Old Storage ID tokens and requests already in flight can outlive revocation.
    // Final sweep only after the maximum token lifetime plus grace; never report completion early.
    await deps.repository.transaction(async tx => {
      const current = await tx.read(activeJobRef, deletionRecord);
      if (!current || current.status !== 'pending' || current.lease !== lease || (current.leaseUntil ?? 0) <= deps.now()) return;
      if (current.phase === 'purge') {
        tx.write(activeJobRef, deletionRecord, {
          phase: 'final_sweep',
          nextAttemptAt: new Date(now + 61 * 60_000),
          leaseUntil: 0,
          lastError: null,
        }, { merge: true });
      } else if (current.phase === 'final_sweep') {
        const counts = readDeletionCounts(current);
        const receiptRef = `deletion_log/${deletionReceiptId(String(current.requestId))}`;
        // Both writes commit together. A conflicting legacy receipt blocks completion.
        tx.create(receiptRef, deletionRecord, buildDeletionAuditReceipt(counts, new Date(deps.now())));
        tx.write(activeJobRef, deletionRecord, {
          requestId: String(current.requestId ?? job.requestId),
          status: 'completed',
          completedAt: new Date(now),
          expiresAt: new Date(now + 30 * 86400_000),
          nextAttemptAt: new Date('9999-01-01'),
          leaseUntil: 0,
        });
      }
    });
  } catch (error) {
    if (error instanceof DeletionPageComplete || error instanceof DeletionTimeSliceComplete || error instanceof DeletionProviderPageComplete || error instanceof DeletionStoragePageComplete) {
      // Acknowledged deletions are the checkpoint: subsequent queries only see
      // remaining documents. Preserve genuine failures across bounded progress.
      await deps.repository.transaction(async tx => {
        const current = await tx.read(ref, deletionRecord);
        if (current?.status !== 'pending' || current.lease !== lease || (current.leaseUntil ?? 0) <= deps.now()) return;
        tx.write(ref, deletionRecord, {
          attempts: Math.max(0, (current.attempts ?? 0) - 1),
          ...(error instanceof DeletionPageComplete
            ? { completedPages: (current.completedPages ?? 0) + 1 }
            : error instanceof DeletionProviderPageComplete
            ? { completedProviderPages: (current.completedProviderPages ?? 0) + 1 }
            : error instanceof DeletionStoragePageComplete
            ? { completedStoragePages: (current.completedStoragePages ?? 0) + 1 }
            : { completedSlices: (current.completedSlices ?? 0) + 1 }),
          lastError: null,
          nextAttemptAt: new Date(deps.now() + 1_000),
          leaseUntil: 0,
        }, { merge: true });
      });
      return;
    }
    // No provider error bodies, email addresses, photos or raw identity data in logs/receipts.
    const attempts = (typeof job.attempts === 'number' ? job.attempts : 0) + 1;
    const maxAttempts = 50;
    if (attempts >= maxAttempts) {
      await deps.repository.transaction(async tx => { const current = await tx.read(ref, deletionRecord); if (current?.lease !== lease) return; tx.write(ref, deletionRecord, { status: 'manual_review', lastError: 'retry_limit_reached', nextAttemptAt: new Date('9999-01-01'), leaseUntil: 0 }, { merge: true }); });
    } else {
      const backoffMs = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts, 6));
      await deps.repository.transaction(async tx => { const current = await tx.read(ref, deletionRecord); if (current?.lease !== lease) return; tx.write(ref, deletionRecord, { lastError: 'retry_required', nextAttemptAt: new Date(now + backoffMs), leaseUntil: 0 }, { merge: true }); });
    }
  }
}

