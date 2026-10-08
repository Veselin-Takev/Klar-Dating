#!/usr/bin/env python3
"""Wire Phase 1b webhooks into server.ts (move-only). Run from repo root on branch refactor/server-webhooks-routes."""
from pathlib import Path
import re
import sys

p = Path('server.ts')
s = p.read_text()
if 'mountStripeRawBody' in s:
    print('Already wired')
    sys.exit(0)

# Import next to existing stripe import
old_imp = 'import { createCheckoutSession, handleStripeWebhook } from "./src/server/stripeService";'
new_imp = '''import { createCheckoutSession } from "./src/server/stripeService";
import { mountStripeRawBody, createWebhooksRouter } from './src/server/routes/webhooks';'''
if old_imp not in s:
    sys.exit('stripe import not found')
s = s.replace(old_imp, new_imp, 1)

old_raw = '''  // Stripe signatures require the untouched request bytes. Parse this path before the global JSON parser.
  app.use("/api/webhooks/stripe", express.raw({ type: "application/json", limit: "256kb" }));
  app.use(express.json({ limit: "1mb" }));'''
new_raw = '''  // Stripe signatures require the untouched request bytes (Phase 1b — see routes/webhooks.ts).
  mountStripeRawBody(app);
  app.use(express.json({ limit: "1mb" }));'''
if old_raw not in s:
    sys.exit('raw middleware block not found')
s = s.replace(old_raw, new_raw, 1)

old_post = '''  // Webhook needs raw body for signature verification
  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const result = await handleStripeWebhook(req.body, signature);
      res.json(result);
    } catch (err: any) {
      console.error('Stripe Webhook Error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
'''
new_post = '''  // Stripe webhook (Phase 1b — raw body mounted earlier via mountStripeRawBody)
  app.use('/api/webhooks', createWebhooksRouter());
'''
if old_post not in s:
    sys.exit('stripe POST block not found — check server.ts for drift')
s = s.replace(old_post, new_post, 1)

if 'handleStripeWebhook' in s:
    sys.exit('handleStripeWebhook still referenced after wiring')
p.write_text(s)
print('OK: server.ts webhooks wired')
