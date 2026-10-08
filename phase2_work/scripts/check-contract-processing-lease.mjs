import fs from 'node:fs';
const source = fs.readFileSync('src/server/contracts.ts','utf8');
const required = [
  'CONTRACT_PROCESSING_LEASE_MS',
  'processingLease',
  'processingLeaseUntil',
  'idempotencyKey: `klar-cancel-${id}`',
  'idempotencyKey: `klar-withdraw-${id}`',
  'current?.processingLease !== lease',
];
for (const needle of required) if (!source.includes(needle)) throw new Error(`missing contract lease invariant: ${needle}`);
if (source.includes('stripe.subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false });')) throw new Error('stripe cancellation without idempotency options');
console.log('PASS check-contract-processing-lease');
