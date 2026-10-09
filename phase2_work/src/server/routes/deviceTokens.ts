import { Router, type Request } from 'express';
import { distributedRateLimit } from '../distributedRateLimiter';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '../db';
import { z } from 'zod';

export type DeviceTokenRouterDeps = {
  getFirestore: () => Firestore;
  currentUserId: (req: Request) => string | null;
};

const payloadSchema = z.object({
  userId: z.string().min(1).max(128).optional(),
  token: z.string().min(20).max(4096).regex(/^\S+$/, 'Invalid token'),
}).strict();

export function createDeviceTokenRouter({ getFirestore, currentUserId }: DeviceTokenRouterDeps): Router {
  const router = Router();
  const deviceTokenWriteLimiter = distributedRateLimit({
    collection: 'rate_limit_device_token_write',
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => {
      const uid = currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    getDb: getFirestore,
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
      await getFirestore()
        .collection('users')
        .doc(uid)
        .collection('fcmTokens')
        .doc(parsed.data.token)
        .set({
          createdAt: FieldValue.serverTimestamp(),
          platform: 'web',
        }, { merge: true });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Device token persistence failed', error);
      return res.status(503).json({ error: 'Device token storage unavailable' });
    }
  });

  return router;
}
