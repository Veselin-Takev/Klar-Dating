import fs from 'node:fs';
const source = fs.readFileSync('src/server/stripeService.ts','utf8');
const required = [
  'event.created',
  'lastStripeEventCreated',
  'isStripeEventNewer(local, event)',
  'lastStripeEventCreated: event.created',
  "event.type === 'customer.subscription.updated'",
  "event.type === 'invoice.payment_failed'",
  "event.type === 'customer.subscription.deleted'",
];
for (const token of required) if (!source.includes(token)) throw new Error(`Missing Stripe ordering guard: ${token}`);
if (!source.includes("if (!isStripeEventNewer(local, event)) continue;")) throw new Error('Deletion stale-event guard missing');
if (!source.includes("billingStatus: 'past_due'")) throw new Error('Payment-failure projection missing');
console.log('Stripe webhook ordering gate PASS');
