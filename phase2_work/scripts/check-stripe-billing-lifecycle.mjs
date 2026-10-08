#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'src/server/stripeService.ts');
const source = fs.readFileSync(file, 'utf8');
const required = [
  "event.type === 'invoice.payment_failed'",
  "billingStatus: 'past_due'",
  "event.type === 'customer.subscription.updated'",
  "event.type === 'customer.subscription.deleted'",
  "billingStatus: 'canceled'",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing Stripe billing lifecycle boundary: ${marker}`);
}
if (!source.includes("lastPaymentFailureAt: FieldValue.serverTimestamp()")) {
  throw new Error('Payment failure timestamp is not durably recorded');
}
if (!source.includes("tx.set(subscriptionRef, {")) {
  throw new Error('Payment failure is not synchronized to the subscription projection');
}
if (!source.includes("subscription.status === 'unpaid'")) {
  throw new Error('Unpaid subscription state is not tracked');
}
console.log('Stripe billing lifecycle gate PASS');
