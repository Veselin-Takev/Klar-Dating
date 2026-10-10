import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');

test('all persistent queue reads avoid a whole-store scan', () => {
  assert.doesNotMatch(source, /async function allItems\s*\(/);
  assert.doesNotMatch(source, /objectStore\(STORE_NAME\)\.getAll\(\s*\)/);
  assert.match(source, /async function itemsForUser\(db: IDBDatabase, ownerUid: string\)/);
  assert.match(source, /\.index\("ownerUid"\)\.getAll\(IDBKeyRange\.only\(ownerUid\)\)/);
});

test('queued checklist uses primary key with an explicit owner check', () => {
  assert.match(source, /itemById\(db, generateChecklistQueueId\(ownerUid\)\)/);
  assert.match(source, /itemById\(db, generateChecklistQueueId\(options\.ownerUid\)\)/);
  assert.match(source, /candidate\?\.ownerUid === ownerUid/);
  assert.match(source, /candidate\?\.ownerUid === options\.ownerUid/);
});

test('message flush and remaining count reuse the same owner index', () => {
  const indexedReads = source.match(/itemsForUser\(db, options\.ownerUid\)/g) ?? [];
  assert.equal(indexedReads.length, 2, 'flush and remaining-count both require scoped reads');
  assert.match(source, /\.filter\(item => item\.status !== 'dead_letter'\)/);
  assert.match(source, /\.sort\(\(a, b\) => a\.queuedAt - b\.queuedAt\)/);
});

test('existing schema index and atomic capacity boundary remain intact', () => {
  assert.match(source, /store\.createIndex\("ownerUid", "ownerUid", \{ unique: false \}\)/);
  assert.match(source, /store\.index\("ownerUid"\)\.count\(IDBKeyRange\.only\(input\.ownerUid\)\)/);
  assert.match(source, /await transactionComplete\(tx\)/);
});
