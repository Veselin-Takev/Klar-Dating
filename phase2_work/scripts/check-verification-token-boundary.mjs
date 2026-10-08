import { readFileSync } from 'node:fs';

const source = readFileSync('src/server/email.ts', 'utf8');
const failures = [];
const requireToken = (token, message) => { if (!source.includes(token)) failures.push(message); };

requireToken("type: 'verification'", 'verification mail must use a dedicated queue type');
requireToken("payload: {}", 'verification queue records must not persist an OOB credential payload');
requireToken('generateEmailVerificationLink(targetEmail)', 'verification OOB credential must be generated immediately before dispatch');
if (source.includes('payload: { verificationLink }')) failures.push('verification OOB credential must never be persisted in mail_queue');
if (source.includes('job.payload?.verificationLink')) failures.push('mail worker must not read persisted verification links');

if (failures.length) {
  console.error('Verification token boundary gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Verification token boundary gate PASS.');
