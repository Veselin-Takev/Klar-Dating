import { readFileSync } from 'node:fs';

const source = readFileSync('src/server/email.ts', 'utf8');
const failures = [];
const requireToken = (token, message) => { if (!source.includes(token)) failures.push(message); };

requireToken('MAIL_LEASE_MS', 'mail worker must use per-job leases');
requireToken('mailLeaseUntil', 'mail worker must persist lease expiry');
requireToken("status: 'processing'", 'mail worker must claim jobs before provider dispatch');
requireToken('current.data()?.mailLease !== lease', 'mail worker finalization must verify lease ownership');
requireToken("status: 'success'", 'successful mail delivery must be terminal');
requireToken('MAX_MAIL_ATTEMPTS', 'mail worker must bound retry attempts');
requireToken("status: terminal ? 'error' : 'pending'", 'mail worker must distinguish retryable and terminal failures');
requireToken('nextAttemptAt', 'mail worker must persist retry scheduling');
requireToken('klar_mail_job_id', 'mail dispatch must carry a stable job identifier');

if (source.includes("status: 'error'\n            }))")) failures.push('mail worker must not leave retryable errors permanently outside the pending queue');
if (source.includes('const batch = getFirestore().batch()')) failures.push('mail worker must not batch-finalize unclaimed jobs; claim must be transactional per job');

if (failures.length) {
  console.error('Email queue reliability gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Email queue reliability gate PASS.');
