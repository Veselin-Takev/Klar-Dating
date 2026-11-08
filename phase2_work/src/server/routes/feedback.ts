import { logSafeFailure } from '../safeErrorLog';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export type FeedbackRouterDeps = {
  repository: () => TenantAwareFirestoreRepository;
  now?: () => Date;
};

const payloadSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional().default(''),
}).strict();

export function createFeedbackRouter({ repository, now = () => new Date() }: FeedbackRouterDeps): Router {
  const router = Router();
  // Anonymous feedback is intentionally public, but it is still a paid Firestore write.
  // Keep the business flow bounded independently of the broad /api limiter.
  const feedbackLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Feedback-Anfragen. Bitte versuche es später erneut.' },
  });
  // This router is mounted at /api. Scope the quota to the actual write endpoint;
  // router.use() here would consume feedback quota for every sibling /api route.
  router.post('/feedback', feedbackLimiter, express.json({ inflate: false, limit: '10kb', strict: true }), async (req, res) => {
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Bitte gib eine Bewertung von 1 bis 5 an.' });
    }

    const created = now();
    const feedbackDoc = {
      rating: parsed.data.rating,
      text: parsed.data.text.trim(),
      uid: 'anonymous',
      createdAt: created.toISOString(),
      timestamp: created.getTime(),
    };

    try {
      await repository().create(`app_feedback/${randomUUID()}`, z.record(z.string(),z.unknown()), feedbackDoc);
      return res.json({ ok: true, message: 'Vielen Dank für dein Feedback!' });
    } catch (error) {
      logSafeFailure('feedback_storage_failure');
      return res.status(503).json({ error: 'Feedback konnte nicht gespeichert werden.' });
    }
  });

  return router;
}
