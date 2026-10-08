import fs from 'node:fs';
const stripe = fs.readFileSync('src/server/stripeService.ts','utf8');
const tests = fs.readFileSync('tests/stripePersistence.spec.ts','utf8');
const required = [
  "plan: 'plus'",
  "autoRenew: true",
  'subscriptionId,',
  "billingStatus: 'active'",
  "plan: 'frei'",
  "subscriptionId: null",
  "billingStatus: 'canceled'",
];
for (const token of required) if (!stripe.includes(token)) throw new Error(`Subscription entitlement invariant missing: ${token}`);
if (!tests.includes("keeps subscription store and entitlement store consistent on deletion")) throw new Error('Missing entitlement consistency regression test');
console.log('Subscription entitlement consistency gate PASS');
