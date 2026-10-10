import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queueItemById, queueItemsForOwner } from '../src/lib/offlineQueueIndexedReads.ts';

const source = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../src/lib/offlineQueueIndexedReads.ts', import.meta.url), 'utf8');

function inMemoryReadDatabase(rows) {
  const calls = [];
  function result(value) {
    const pending = { result: value, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => pending.onsuccess?.());
    return pending;
  }
  const db = {
    transaction(storeName, mode) {
      calls.push(['transaction', storeName, mode]);
      return {
        objectStore(name) {
          assert.equal(name, 'pending_writes');
          return {
            get(id) { calls.push(['get', id]); return result(rows.find(row => row.id === id)); },
            index(indexName) {
              assert.equal(indexName, 'ownerUid');
              return {
                getAll(range) {
                  calls.push(['index.getAll', range.only]);
                  return result(rows.filter(row => row.ownerUid === range.only));
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

test('all persistent queue reads are explicitly scoped', () => {
  assert.doesNotMatch(source, /async function allItems\s*\(/);
  assert.doesNotMatch(source, /objectStore\(STORE_NAME\)\.getAll\(\s*\)/);
  assert.match(source, /import \{ queueItemById, queueItemsForOwner \} from '\.\/offlineQueueIndexedReads'/);
  assert.match(helper, /\.index\('ownerUid'\)\.getAll\(IDBKeyRange\.only\(ownerUid\)\)/);
});

test('queued checklist reads by key and checks the owner independently', () => {
  assert.equal((source.match(/queueItemById<PendingQueueItem>\(db, STORE_NAME, generateChecklistQueueId\(/g) ?? []).length, 2);
  assert.match(source, /candidate\?\.ownerUid === ownerUid/);
  assert.match(source, /candidate\?\.ownerUid === options\.ownerUid/);
});

test('message flush and remaining count both use the owner index', () => {
  assert.equal((source.match(/queueItemsForOwner<PendingQueueItem>\(db, STORE_NAME, options\.ownerUid\)/g) ?? []).length, 2);
  assert.match(source, /\.filter\(item => item\.status !== 'dead_letter'\)/);
  assert.match(source, /\.sort\(\(a, b\) => a\.queuedAt - b\.queuedAt\)/);
});

test('existing schema index and atomic capacity remain intact', () => {
  assert.match(source, /store\.createIndex\("ownerUid", "ownerUid", \{ unique: false \}\)/);
  assert.match(source, /store\.index\("ownerUid"\)\.count\(IDBKeyRange\.only\(input\.ownerUid\)\)/);
});

test('indexed reads return only the requested account, not another users private content', async () => {
  const rows = [
    { id: 'message:alice:a', ownerUid: 'alice', payload: { text: 'A' } },
    { id: 'message:bob:b', ownerUid: 'bob', payload: { text: 'B-private' } },
    { id: 'checklist:date_prep:alice', ownerUid: 'alice', payload: { checklist: { battery: true } } },
  ];
  const { db, calls } = inMemoryReadDatabase(rows);
  const previous = globalThis.IDBKeyRange;
  globalThis.IDBKeyRange = { only: only => ({ only }) };
  try {
    const alice = await queueItemsForOwner(db, 'pending_writes', 'alice');
    assert.equal(alice.length, 2);
    assert.ok(alice.every(item => item.ownerUid === 'alice'));
    assert.deepEqual(calls.filter(([op]) => op === 'index.getAll'), [['index.getAll', 'alice']]);
    assert.equal(await queueItemById(db, 'pending_writes', 'checklist:date_prep:alice'), rows[2]);
    assert.ok(calls.some(([op,id]) => op === 'get' && id === 'checklist:date_prep:alice'));
  } finally {
    if (previous === undefined) delete globalThis.IDBKeyRange;
    else globalThis.IDBKeyRange = previous;
  }
});

test('an absent owner fails closed before accessing IndexedDB', async () => {
  const { db, calls } = inMemoryReadDatabase([]);
  await assert.rejects(queueItemsForOwner(db, 'pending_writes', ''), /invalid_queue_owner/);
  assert.deepEqual(calls, []);
});
