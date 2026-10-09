import { Router, type Request } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { distributedRateLimit } from '../distributedRateLimiter';
import { z } from 'zod';
import { CheckoutConflictError } from '../stripeService';

export type BillingRouterDeps = {
  currentUserId: (req: Request) => string | null;
  isBookable: () => boolean;
  validateReturnUrl: (returnUrl: string) => string;
  createCheckoutSession: (userId: string, returnUrl: string) => Promise<string | null>;
  getFirestore?: () => Firestore;
};

const checkoutPayload = z.object({
  userId: z.string().min(1).max(128).optional(),
  returnUrl: z.string().url().max(2048),
}).strict();

export function createBillingRouter(deps: BillingRouterDeps): Router {
  const router = Router();
  const checkoutCreationLimiter = distributedRateLimit({
    collection: 'rate_limit_billing_checkout',
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => {
      const uid = deps.currentUserId(req);
      return uid ? 'uid:' + uid : '';
    },
    getDb: deps.getFirestore,
    message: { error: 'Zu viele Checkout-Anfragen. Bitte versuche es später erneut.' },
  });

  router.post('/subscribe-klar-plus', checkoutCreationLimiter, async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    if (!deps.isBookable()) {
      return res.status(501).json({
        code: 'klar_plus_not_bookable',
        error: 'Klar+ ist noch nicht buchbar.',
      });
    }

    const parsed = checkoutPayload.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid checkout payload' });
    if (parsed.data.userId && parsed.data.userId !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let safeReturnUrl: string;
    try {
      safeReturnUrl = deps.validateReturnUrl(parsed.data.returnUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid returnUrl' });
    }

    try {
      const url = await deps.createCheckoutSession(uid, safeReturnUrl);
      if (!url) return res.status(503).json({ error: 'Checkout unavailable' });
      return res.json({ url });
    } catch (error) {
      if (error instanceof CheckoutConflictError) {
        return res.status(error.status).json({ code: error.code, error: error.code === 'subscription_exists'
          ? 'Für dieses Konto besteht bereits ein Klar+ Abonnement.'
          : 'Für dieses Konto wird bereits ein Checkout erstellt. Bitte kurz warten.' });
      }
      console.error('Klar+ checkout creation failed', error);
      return res.status(503).json({ error: 'Checkout unavailable' });
    }
  });

  return router;
}
