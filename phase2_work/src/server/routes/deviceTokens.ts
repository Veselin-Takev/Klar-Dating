import { logSafeFailure } from '../safeErrorLog';
import { Router, type Request } from 'express';
import { distributedRateLimit } from '../distributedRateLimiter';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { FieldValue } from '../db';
import { z } from 'zod';

export type DeviceTokenRouterDeps = {
  repository: () => TenantAwareFirestoreRepository;
  currentUserId: (req: Request) => string | null;
};

const payloadSchema = z.object({
  userId: z.string().min(1).max(128).optional(),
  token: z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:-]+$/, 'Invalid token'),
}).strict();

export function createDeviceTokenRouter({ repository, currentUserId }: DeviceTokenRouterDeps): Router {
  const router = Router();
  const deviceTokenWriteLimiter = distributedRateLimit({
    collection: 'rate_limit_device_token_write',
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => {
      const uid = currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    repository,
    message: { error: 'Zu viele Geräte-Token-Anfragen. Bitte versuche es später erneut.' },
  });

  router.post('/device-token', deviceTokenWriteLimiter, async (req, res) => {
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid device token payload' });
    if (parsed.data.userId && parsed.data.userId !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await repository().transaction(async tx => {
        const deletion = await tx.read(`account_deletions/${uid}`, z.record(z.string(), z.unknown()));
        if (deletion) throw new Error('account_unavailable');
        tx.write(`users/${uid}/fcmTokens/${parsed.data.token}`, z.object({createdAt:z.unknown(), platform:z.literal('web')}), {createdAt:FieldValue.serverTimestamp(), platform:'web'}, {merge:true});
      });

      return res.json({ ok: true });
    } catch (error) {
      logSafeFailure('device_token_storage_failure');
      return res.status(503).json({ error: 'Device token storage unavailable' });
    }
  });

  return router;
}
