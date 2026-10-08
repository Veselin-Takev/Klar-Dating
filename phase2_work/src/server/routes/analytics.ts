import express, { Router, type ErrorRequestHandler, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { FunnelEventPayloadSchema } from '../../services/funnelValidation';
import { currentUserId } from '../authorization';
import { zweckErlaubt } from '../pure';

type Dependencies = { requireAuth: RequestHandler; getDb: () => Firestore; enabled: () => boolean };
/** Mount before the global JSON parser, so oversized bodies never reach the 1 MB parser. */
export function createAnalyticsRouter({ requireAuth, getDb, enabled }: Dependencies) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60_000, limit: 30, keyGenerator: (req) => currentUserId(req) ?? req.ip ?? 'unknown', standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many analytics requests' } }));
  router.use(express.json({ limit: 10 * 1024, strict: true }));
  const parseError: ErrorRequestHandler = (error, _req, res, next) => {
    if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid analytics payload (maximum 10 KB)' }); return; }
    next(error);
  };
  router.use(parseError);
  router.post('/', requireAuth, async (req, res) => {
    const parsed = FunnelEventPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid funnel event' });
    if (!enabled()) return res.status(503).json({ error: 'Product analytics disabled' });
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = getDb();
      const profile = await db.collection('users').doc(uid).get();
      if (!zweckErlaubt(profile.data()?.einwilligung, 'produktanalyse')) return res.status(403).json({ error: 'Product analytics consent required' });
      const { sessionId, timestamp: _clientTime, ...event } = parsed.data;
      await db.collection('funnel_events').add({
        ...event, userId: uid,
        sessionId: createHash('sha256').update(`${uid}:${sessionId}`).digest('hex'),
        serverTimestamp: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000),
      });
      return res.status(201).json({ ok: true });
    } catch { return res.status(503).json({ error: 'Analytics storage unavailable' }); }
  });
  return router;
}
