import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/email.ts', 'utf8');
const failures = [];
const requireToken = (token, message) => { if (!source.includes(token)) failures.push(message); };
requireToken("['processing', 'dispatching']", 'mail worker must inspect processing/dispatching jobs so expired leases can be quarantined');
requireToken("data.status === 'processing' || data.status === 'dispatching'", 'mail worker must honor active processing/dispatching leases');
requireToken('const leaseUntil =', 'mail worker must normalize persisted lease timestamps');
if (!source.includes(".where('status', 'in', ['pending', 'offen'])")) failures.push('mail worker must select ready pending/open jobs');
if (!source.includes(".where('status', 'in', ['processing', 'dispatching'])")) failures.push('mail worker must select stale processing/dispatching leases');
if (!source.includes("if (data.status === 'dispatching')")) failures.push('mail worker must quarantine expired dispatching jobs');
if (failures.length) { console.error('Mail lease recovery gate FAILED:'); failures.forEach(f => console.error(`- ${f}`)); process.exit(1); }
console.log('Mail lease recovery gate PASS.');
