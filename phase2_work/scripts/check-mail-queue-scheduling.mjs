import fs from 'node:fs';

const source = fs.readFileSync('src/server/email.ts', 'utf8');
const passwordReset = fs.readFileSync('src/server/passwordReset.ts', 'utf8');
const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
const failures = [];
if (!source.includes(".where('nextAttemptAt', '<=', new Date(now))")) failures.push('mail worker must select due jobs at query level');
if (!source.includes(".where('mailLeaseUntil', '<=', new Date(now))")) failures.push('mail worker must select stale leases at query level');
if (!source.includes(".orderBy('nextAttemptAt', 'asc')")) failures.push('ready mail jobs must be ordered by due time');
if (!source.includes(".orderBy('mailLeaseUntil', 'asc')")) failures.push('stale leases must be ordered by lease expiry');
if (!source.includes("nextAttemptAt: new Date()")) failures.push('verification queue jobs must initialize nextAttemptAt');
if (!passwordReset.includes("nextAttemptAt: new Date()")) failures.push('password-reset queue jobs must initialize nextAttemptAt');
const fields = indexes.indexes ?? [];
const has = (second) => fields.some(i => i.collectionGroup === 'mail_queue' && i.fields?.some(f => f.fieldPath === second));
if (!has('nextAttemptAt')) failures.push('mail_queue nextAttemptAt composite index missing');
if (!has('mailLeaseUntil')) failures.push('mail_queue mailLeaseUntil composite index missing');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Mail queue scheduling gate: PASS');
