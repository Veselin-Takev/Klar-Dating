import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/complianceJobs.ts', 'utf8');
const failures = [];
const requireToken = (token, message) => { if (!source.includes(token)) failures.push(message); };
requireToken('MAX_RECEIPT_MAIL_ATTEMPTS', 'contract receipt mail must bound retries');
requireToken("mailStatus: 'processing'", 'contract receipt mail must claim jobs before provider dispatch');
requireToken("current?.mailLease !== lease", 'contract receipt finalization must verify lease ownership');
requireToken('mailAttempts', 'contract receipt mail must persist retry attempts');
requireToken('mailError', 'contract receipt mail must persist bounded error details');
requireToken('RECEIPT_RETRYABLE_HTTP', 'contract receipt mail must classify retryable provider responses');
requireToken("mailStatus: terminal ? 'error' : 'pending'", 'contract receipt mail must distinguish terminal failures');
if (failures.length) { console.error('Contract mail reliability gate FAILED:'); failures.forEach(f => console.error(`- ${f}`)); process.exit(1); }
console.log('Contract mail reliability gate PASS.');
