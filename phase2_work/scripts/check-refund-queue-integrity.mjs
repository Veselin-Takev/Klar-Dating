import fs from 'node:fs';
const contracts = fs.readFileSync('src/server/contracts.ts', 'utf8');
const tests = fs.readFileSync('tests/contractsPersistence.spec.ts', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const required = [
  "tx.write(`refund_queue/${id}`, contractRecord,",
  "status: 'review_required'",
  "grund: 'widerruf'",
  "dueAt: new Date(Date.now() + 14 * 24 * 60 * 60_000)",
];
for (const needle of required) if (!contracts.includes(needle)) throw new Error(`Missing refund queue invariant: ${needle}`);
if (!tests.includes('withdraws once through the scoped ledger and leaves root and foreign data untouched')) throw new Error('Missing refund queue regression test');
const refundBlock = contracts.split("tx.write(`refund_queue/${id}`, contractRecord,")[1]?.split('});')[0] ?? '';
if (refundBlock.includes('uid:')) throw new Error('Refund queue must not persist uid directly');
if (!rules.includes("match /refund_queue/{refundId}")) throw new Error('refund_queue rules boundary missing');
console.log('Refund queue integrity gate PASS');
