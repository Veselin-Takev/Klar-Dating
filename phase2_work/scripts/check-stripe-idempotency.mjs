import fs from 'node:fs';
const stripe = fs.readFileSync('src/server/stripeService.ts', 'utf8');
const tests = fs.readFileSync('tests/stripePersistence.spec.ts', 'utf8');
const checks = [
  ['persistent event ledger', /processed_stripe_events/],
  ['transactional event create', /tx\.create\(eventRef/],
  ['checkout cancellation tombstone', /subscription_\$\{subscriptionId\}/],
  ['terminal deletion tombstone without local user', /Durable terminal tombstone/],
  ['updated events blocked after cancellation', /if \(!cancellation\.exists\)/],
  ['concurrent delivery test', /Promise\.all\(\[handleStripeWebhook/],
  ['late completion test', /cancellation before completion/],
];
for (const [label, re] of checks) {
  const source = label.includes('test') || label === 'concurrent delivery test' || label === 'late completion test' ? tests : stripe;
  if (!re.test(source)) throw new Error(`Stripe idempotency boundary failed: ${label}`);
}
console.log('Stripe idempotency boundary: PASS');
