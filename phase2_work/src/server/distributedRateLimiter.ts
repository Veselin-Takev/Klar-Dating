import type { NextFunction, Request, Response } from 'express';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import crypto from 'node:crypto';
import { z } from 'zod';
import { scopeServiceDatabase, getServiceRepository } from './firestoreRepository/nativeDatabase';
import type { Firestore } from 'firebase-admin/firestore';

export type DistributedRateLimitOptions = {
  collection: string;
  windowMs: number;
  limit: number;
  keyGenerator: (req: Request) => string;
  message: Record<string, unknown>;
  nativeDatabaseFactory?: () => Firestore;
  repository?: () => Pick<TenantAwareFirestoreRepository, 'transaction'>;
  domain?: 'auth' | 'payments';
};

const counterSchema = z.object({count: z.number().int().nonnegative(), windowStartedAt: z.number().finite(), expiresAt: z.unknown()});
const patchSchema = counterSchema.partial();
function hashKey(collection: string, identity: string): string {
  return crypto.createHash('sha256').update('klar-rate-limit:' + collection + ':' + identity, 'utf8').digest('hex');
}

export function distributedRateLimit(options: DistributedRateLimitOptions) {
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) throw new Error('Invalid rate-limit window.');
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) throw new Error('Invalid rate-limit limit.');
  return async function distributedRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const candidate = options.keyGenerator(req).trim();
    if (!candidate) return next();
    const identity = candidate;
    const ref = `${options.collection}/${hashKey(options.collection, identity)}`;
    const now = Date.now();
    try {
      const db = options.repository ? options.repository() : options.nativeDatabaseFactory ? scopeServiceDatabase(options.nativeDatabaseFactory(), options.domain ?? 'auth') : getServiceRepository(options.domain ?? 'auth');
      const result = await db.transaction(async tx => {
        const data = await tx.read(ref, counterSchema);
        const start = Number(data?.windowStartedAt);
        const count = Number(data?.count);
        const valid = Number.isFinite(start) && Number.isSafeInteger(count) && count >= 0 && now >= start && now - start < options.windowMs;
        if (!valid) {
          tx.write(ref, counterSchema, { count: 1, windowStartedAt: now, expiresAt: new Date(now + options.windowMs) });
          return { allowed: true, remaining: Math.max(0, options.limit - 1), resetAt: now + options.windowMs };
        }
        if (count >= options.limit) return { allowed: false, remaining: 0, resetAt: start + options.windowMs };
        const nextCount = count + 1;
        tx.write(ref, patchSchema, { count: nextCount, expiresAt: new Date(start + options.windowMs) }, {merge: true});
        return { allowed: true, remaining: Math.max(0, options.limit - nextCount), resetAt: start + options.windowMs };
      });
      const seconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
      res.setHeader('RateLimit-Limit', options.limit);
      res.setHeader('RateLimit-Remaining', result.remaining);
      res.setHeader('RateLimit-Reset', seconds);
      if (!result.allowed) {
        res.setHeader('Retry-After', Math.max(1, seconds));
        return res.status(429).json(options.message);
      }
      return next();
    } catch (error) {
      console.error('rate_limit_unavailable');
      return res.status(503).json({ error: 'Sicherheitslimit derzeit nicht verfügbar. Bitte später erneut versuchen.' });
    }
  };
}
