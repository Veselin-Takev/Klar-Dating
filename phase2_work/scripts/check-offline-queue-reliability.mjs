import { readFileSync } from 'node:fs';

const queue = readFileSync('src/lib/offlineQueue.ts', 'utf8');
const failures = [];

for (const needle of [
  "status?: 'pending' | 'dead_letter'",
  "status: 'dead_letter'",
  'deadLetteredAt',
  'retry_limit_reached',
  'function retryableStatus(status: number)',
  'status === 408 || status === 425 || status === 429 || status >= 500',
  'responseError(res, body)',
  'store.index("ownerUid").count(IDBKeyRange.only(input.ownerUid))',
  'const tx = db.transaction(STORE_NAME, "readwrite")',
]) {
  if (!queue.includes(needle)) failures.push(`offlineQueue.ts: missing reliability invariant ${needle}`);
}
if (!queue.includes("item.status !== 'dead_letter'")) failures.push('offlineQueue.ts: dead-lettered items must not be retried automatically');
if (!queue.includes('lastError: error')) failures.push('offlineQueue.ts: terminal/retry errors must be persisted');
if (queue.includes('const items = await allItems(db);\n    const owned = items.filter(item => item.ownerUid === input.ownerUid);')) {
  failures.push('offlineQueue.ts: queue capacity must not use a non-atomic getAll/count pattern');
}
if (queue.includes('res.status === 400')) failures.push('offlineQueue.ts: retry policy must classify HTTP status centrally');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Offline queue reliability gate PASS: retry policy, error persistence and atomic capacity boundary are enforced.');
