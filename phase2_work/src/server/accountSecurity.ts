import { getAuth, type Auth } from 'firebase-admin/auth';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { revokeAccountMediaCapabilities } from './mediaCapabilities';
import { randomUUID } from 'node:crypto';

const record = z.record(z.string(), z.unknown());
type SecurityRepository = Pick<TenantAwareFirestoreRepository, 'transaction' | 'list'>;
const missing = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found';
export function securityJob(previous: Record<string, unknown> | null, action: 'disable' | 'enable', now: Date) {
  return { requestId: randomUUID(), action, createdAt: now, nextAttemptAt: now, lease: previous?.lease ?? '', leaseUntil: Number(previous?.leaseUntil) || 0 };
}

/** Attempt both operations, even if either provider operation fails. A durable
 * Firestore fence must already exist. Never expose provider error payloads. */
export async function disableAndRevoke(uid: string, auth: Pick<Auth, 'updateUser' | 'revokeRefreshTokens'> = getAuth()): Promise<void> {
  const outcomes = await Promise.allSettled([
    Promise.resolve().then(() => auth.updateUser(uid, { disabled: true })),
    Promise.resolve().then(() => auth.revokeRefreshTokens(uid)),
  ]);
  if (outcomes.some(outcome => outcome.status === 'rejected' && !missing(outcome.reason))) {
    throw new Error('account_security_retry_required');
  }
}

export async function enforceAccountLock(uid: string, repo: SecurityRepository): Promise<void> {
  const path = `account_security_jobs/${uid}`, lease = randomUUID();
  const job = await repo.transaction(async tx => {
    const current = await tx.read(path, record);
    if (!current || Number(current.leaseUntil) > Date.now()) return null;
    if (current.action === 'enable') {
      const [user, deletion] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record)]);
      if (!user || user.active !== true || deletion) throw new Error('account_unlock_forbidden');
    }
    tx.write(path, record, {lease, leaseUntil:Date.now()+15*60_000}, {merge:true});
    return current;
  });
  if (!job) return;
  try {
    const applyAuth = async () => {
      if (job.action !== 'enable') return disableAndRevoke(uid);
      const auth = getAuth();
      const results = await Promise.allSettled([auth.updateUser(uid, {disabled:false}),auth.revokeRefreshTokens(uid)]);
      if (results.some(result=>result.status==='rejected')) throw new Error('account_security_retry_required');
    };
    const results = await Promise.allSettled([applyAuth(), revokeAccountMediaCapabilities(uid)]);
    if (results.some(result => result.status === 'rejected')) throw new Error('account_security_retry_required');
    await repo.transaction(async tx => {
      const [current, user, deletion] = await Promise.all([tx.read(path, record), tx.read(`users/${uid}`,record), tx.read(`account_deletions/${uid}`,record)]);
      if (current?.lease !== lease) return;
      if (current.requestId !== job.requestId) { tx.write(path,record,{leaseUntil:0},{merge:true}); return; }
      if (job.action === 'enable') {
        if (!user || user.active !== true || deletion) throw new Error('account_unlock_forbidden');
        tx.delete(`account_locks/${uid}`);
        tx.write(`users/${uid}`,record,{mediaAccessState:user.isAdult===true?'active':'blocked'},{merge:true});
      }
      tx.delete(path);
    });
  } catch {
    await repo.transaction(async tx => {
      const current=await tx.read(path,record);
      if(current?.lease===lease)tx.write(path,record,{leaseUntil:0,nextAttemptAt:new Date(Date.now()+60_000),lastError:'security_retry_required'},{merge:true});
    });
    throw new Error('account_security_retry_required');
  }
}

export async function retryAccountSecurityJobs(repo: SecurityRepository): Promise<number> {
  const jobs = await repo.list('account_security_jobs', record, { where:['nextAttemptAt','<=',new Date()], orderBy:'nextAttemptAt', limit: 20 });
  let completed = 0;
  for (const job of jobs) {
    try { await enforceAccountLock(job.id, repo); completed++; } catch { /* Durable job survives. */ }
  }
  return completed;
}
