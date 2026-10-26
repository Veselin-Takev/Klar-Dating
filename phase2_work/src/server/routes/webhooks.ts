/**
 * Webhook routes — Phase 1b (move-only).
 *
 * CRITICAL ORDERING:
 * 1. Call mountStripeRawBody(app) BEFORE app.use(express.json(...)).
 * 2. Mount createWebhooksRouter() at '/api/webhooks' (any time after raw mount).
 *
 * Stripe signature verification requires the untouched request body (Buffer).
 * If express.json() runs first on this path, constructEvent fails.
 */
import express, { Router, type Express, type Request, type Response } from 'express';
import { handleStripeWebhook } from '../stripeService';

/**
 * Path-scoped raw body parser. Must run before the global JSON parser.
 */
export function mountStripeRawBody(app: Express): void {
  // Stripe signatures require the untouched request bytes. Parse this path before the global JSON parser.
  app.use('/api/webhooks/stripe', express.raw({ inflate: false, type: 'application/json', limit: '256kb' }));
}

export function createWebhooksRouter(): Router {
  const router = Router();

  // Webhook needs raw body for signature verification (see mountStripeRawBody).
  router.post('/stripe', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const result = await handleStripeWebhook(req.body as Buffer, signature);
      res.json(result);
    } catch {
      console.warn('stripe_webhook_rejected');
      res.status(400).json({ error: 'Invalid webhook' });
    }
  });

  return router;
}

