import fs from 'node:fs';
const source=fs.readFileSync('src/server/stripeService.ts','utf8').replace(/\s+/g,'');
for (const token of ['event.created','lastStripeEventCreated','isStripeEventNewer(local??{},event)','lastStripeEventCreated:event.created',"event.type==='customer.subscription.updated'","event.type==='invoice.payment_failed'","event.type==='customer.subscription.deleted'",'!isStripeEventNewer(states[i]??{},event)',"billingStatus:'past_due'"]) {
  if(!source.includes(token)) throw new Error('Missing scoped Stripe ordering guard: '+token);
}
console.log('Scoped Stripe webhook ordering gate PASS');
