import nativeRateLimit, { type Options, type Store, type IncrementResponse } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { timestampMillis } from '../../functions/src/firestoreRepository/runtimeSchemas';

const counter = z.object({ totalHits: z.number().int().nonnegative(), resetAt: z.number().finite(), expiresAt: z.unknown() });
const namespaces = ['admin-health-check-limiter','api-limiter','ki-limiter','gast-ki-limiter','uebersetzung-limiter','gast-uebersetzung-limiter','contact-write-limiter','contact-undo-limiter','contract-mutation-limiter','analytics','kyc-status'];
export function accountRateLimitPaths(uid: string): string[] {
  return namespaces.flatMap(namespace => [uid, `konto-${uid}`, `gast-${uid}`, `ueb-${uid}`, `ueb-gast-${uid}`].map(key => 'api_rate_limits/' + createHash('sha256').update(namespace + ':' + key).digest('hex')));
}
export async function cleanupExpiredApiLimits(repo: Pick<TenantAwareFirestoreRepository,'list'|'transaction'>): Promise<number> {
  const now = new Date();
  const rows = await repo.list('api_rate_limits',counter,{where:['expiresAt','<=',now],limit:200});
  return repo.transaction(async tx=>{
    const current = await Promise.all(rows.map(row=>tx.read(`api_rate_limits/${row.id}`,counter)));
    let deleted=0;
    current.forEach((data,index)=>{if(data && timestampMillis(data.expiresAt)>0 && timestampMillis(data.expiresAt)<=now.getTime()){tx.delete(`api_rate_limits/${rows[index]!.id}`);deleted++;}});
    return deleted;
  });
}
/** Every instance uses the same namespace and atomic Firestore counter. No local
 * fallback. TTL is housekeeping only; window expiry is checked transactionally. */
export class FirestoreRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;
  private pendingTotal = 0;
  private queues = new Map<string, { tail: Promise<void>; pending: number }>();
  constructor(namespace: string, private repository: () => TenantAwareFirestoreRepository) {
    if (!/^[a-z0-9_-]{1,80}$/.test(namespace)) throw new Error('invalid_rate_limit_namespace');
    this.prefix = namespace + ':';
  }
  init(options: Options) { this.windowMs = options.windowMs; }
  private path(key: string) { return 'api_rate_limits/' + createHash('sha256').update(this.prefix + key).digest('hex'); }
  private async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const id = this.path(key), queue = this.queues.get(id) ?? {tail:Promise.resolve(),pending:0};
    if (queue.pending >= 128 || this.pendingTotal >= 512) throw new Error('rate_limit_busy');
    const previous = queue.tail, enteredAt = Date.now();
    let release!: () => void;
    queue.tail = new Promise<void>(resolve => { release = resolve; });
    queue.pending++; this.pendingTotal++; this.queues.set(id,queue);
    await previous;
    try {
      if (Date.now()-enteredAt > 10_000) throw new Error('rate_limit_busy');
      return await work();
    } finally {
      queue.pending--; this.pendingTotal--; release();
      if (!queue.pending) this.queues.delete(id);
    }
  }
  async increment(key: string): Promise<IncrementResponse> {
    return this.exclusive(key, () => this.repository().transaction(async tx => {
      const now = Date.now();
      const path = this.path(key), previous = await tx.read(path, counter);
      const valid = previous && previous.resetAt > now && previous.resetAt <= now + this.windowMs;
      const totalHits = valid ? Math.min(Number.MAX_SAFE_INTEGER, previous.totalHits + 1) : 1;
      const resetAt = valid ? previous.resetAt : now + this.windowMs;
      tx.write(path, counter, { totalHits, resetAt, expiresAt: new Date(resetAt) });
      return { totalHits, resetTime: new Date(resetAt) };
    }));
  }
  async decrement(key: string): Promise<void> {
    await this.exclusive(key, () => this.repository().transaction(async tx => {
      const path = this.path(key), previous = await tx.read(path, counter);
      if (previous) tx.write(path, counter, { ...previous, totalHits: Math.max(0, previous.totalHits - 1) });
    }));
  }
  async resetKey(key: string): Promise<void> { await this.exclusive(key, () => this.repository().delete(this.path(key))); }
}

export default function rateLimit(options: Partial<Options> & { namespace: string; repository?: () => TenantAwareFirestoreRepository }): RequestHandler {
  const { namespace, repository = () => getServiceRepository('auth'), ...policy } = options;
  const middleware = nativeRateLimit({ ...policy, passOnStoreError: false, store: new FirestoreRateLimitStore(namespace, repository) });
  return (req, res, next) => middleware(req, res, error => {
    if (error) { res.status(503).json({ code: 'rate_limit_unavailable' }); return; }
    next();
  });
}
