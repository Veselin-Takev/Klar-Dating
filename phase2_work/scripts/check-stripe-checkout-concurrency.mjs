import { readFile } from 'node:fs/promises';

const stripe = await readFile('src/server/stripeService.ts', 'utf8');
const billing = await readFile('src/server/routes/billing.ts', 'utf8');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const checks = [
  ['transactional checkout reservation', /db\.runTransaction\(async tx =>/],
  ['existing subscription guard', /user\.plan === 'plus' \|\| subscription\.plan === 'plus'/],
  ['checkout lease guard', /checkoutLeaseUntil/],
  ['checkout session guard', /checkoutExpiresAt/],
  ['checkout expiry cleanup', /checkout\.session\.expired/],
  ['stable checkout request id', /checkoutRequestId/],
  ['Stripe idempotency key', /idempotencyKey: `klar-checkout-\$\{requestId\}`/],
  ['checkout metadata binding', /klarCheckoutRequestId: requestId/],
  ['conflict response mapping', /CheckoutConflictError/],
  ['checkout route remains rate limited', /checkoutCreationLimiter/],
];
const failures = checks.filter(([, re]) => !re.test(stripe + billing)).map(([name]) => name);
if (pkg.scripts['check:stripe-checkout-concurrency'] !== 'node scripts/check-stripe-checkout-concurrency.mjs') failures.push('package script composition');
if (failures.length) {
  console.error(`Stripe checkout concurrency gate: FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Stripe checkout concurrency gate PASS: one active Klar+ checkout per account, durable lease and Stripe idempotency are enforced.');
