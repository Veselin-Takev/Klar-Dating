import { readFileSync } from 'node:fs';

const source = readFileSync('src/server/email.ts', 'utf8');
const failures = [];
const requireToken = (token, message) => { if (!source.includes(token)) failures.push(message); };

requireToken("status: 'dispatching'", 'mail worker must durably mark dispatching before provider submission');
requireToken("status: 'dispatch_unknown'", 'ambiguous provider outcomes must enter a non-retryable reconciliation state');
requireToken('dispatchStarted = true;', 'provider submission boundary must be explicit');
requireToken('if (dispatchStarted)', 'provider ambiguity must be handled separately from pre-dispatch failures');
requireToken("nextAttemptAt: new Date('9999-01-01')", 'dispatch_unknown jobs must not be automatically retried');
requireToken('klar_dispatch_digest', 'provider dispatch must carry a stable reconciliation digest');

if (source.includes("['pending', 'offen', 'processing', 'dispatching']") && !source.includes("dispatch_lease_expired_unknown")) {
  failures.push('dispatching jobs require explicit stale-lease quarantine');
}
if (source.includes("status: terminal ? 'error' : 'pending'")) {
  // Allowed only in the pre-dispatch failure branch. Ensure the ambiguous branch exists first.
  if (!source.includes('if (dispatchStarted)')) failures.push('automatic retry branch must be unreachable for ambiguous dispatches');
}

if (failures.length) {
  console.error('Mail dispatch integrity gate FAILED:');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}
console.log('Mail dispatch integrity gate PASS.');

requireToken('dispatch_lease_expired_unknown', 'expired dispatching leases must be quarantined as dispatch_unknown');
