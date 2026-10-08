import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/accountDeletion.ts', 'utf8');
const required = [
  "const maxAttempts = 50;",
  "status: 'manual_review'",
  "lastError: 'retry_limit_reached'",
  'Math.min(60 * 60_000',
  '2 ** Math.min(attempts, 6)',
];
const missing = required.filter((needle) => !source.includes(needle));
if (missing.length) {
  console.error(`FAIL account-deletion retry policy: ${missing.join(', ')}`);
  process.exit(1);
}
if (source.includes("status: 'completed'" ) && !source.includes("job.phase === 'purge'")) {
  console.error('FAIL account-deletion retry policy: completed state must remain phase-gated');
  process.exit(1);
}
console.log('PASS account-deletion retry policy');
