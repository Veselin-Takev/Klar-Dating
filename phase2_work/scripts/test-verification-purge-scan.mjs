import test from 'node:test';
import assert from 'node:assert/strict';
import { scanPurgePages, readPurgeCursor } from '../src/server/platform/verificationPurgeScan.ts';

const items = Array.from({ length: 255 }, (_, i) => ({
  cursor: { seconds: 100 + i, nanos: 0, id: 'id' + i }, value: i,
}));
function fixture(pageSize = 40, maxPages = 3) {
  let cursor = null;
  const seen = [];
  const run = () => scanPurgePages({
    initial: cursor, pageSize, maxPages,
    fetch: async after => {
      const pos = after ? items.findIndex(item => item.cursor.id === after.id) + 1 : 0;
      return items.slice(pos, pos + pageSize);
    },
    handle: async values => {
      seen.push(...values);
      return { purged: values.filter(i => i >= 220).length,
        skipped: values.filter(i => i < 220).length, failed: 0 };
    },
    checkpoint: async value => { cursor = value; },
  });
  return { run, seen, cursor: () => cursor };
}

test('255 records progress across bounded invocations and reset checkpoint', async () => {
  const f = fixture();
  assert.equal((await f.run()).scanned, 120);
  assert.equal((await f.run()).scanned, 120);
  const last = await f.run();
  assert.equal(last.scanned, 15);
  assert.equal(last.hasMore, false);
  assert.equal(f.cursor(), null);
  assert.deepEqual(f.seen, items.map(i => i.value));
});

test('invalid cursors, wrong ordering and oversized pages fail closed', async () => {
  assert.throws(() => readPurgeCursor({ seconds: 1, nanos: -1, id: 'a' }), /invalid/);
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 1, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => ({ purged: 1, skipped: 0, failed: 0 }), checkpoint: async () => {},
  }), /page_invalid/);
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => [items[1], items[0]],
    handle: async () => ({ purged: 1, skipped: 1, failed: 0 }), checkpoint: async () => {},
  }), /order_invalid/);
});

test('individual failures advance checkpoint for eventual retry after wrap', async () => {
  let cursor = null;
  const scan = await scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => ({ purged: 0, skipped: 1, failed: 1 }),
    checkpoint: async next => { cursor = next; },
  });
  assert.equal(scan.failed, 1);
  assert.equal(scan.hasMore, true);
  assert.equal(cursor.id, 'id1');
});

test('a fatal page error never advances the checkpoint', async () => {
  let checkpoints = 0;
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => { throw Error('transient'); },
    checkpoint: async () => { checkpoints++; },
  }), /transient/);
  assert.equal(checkpoints, 0);
});

test('a deadline is respected after a complete page checkpoint', async () => {
  let checks = 0;
  const scan = await scanPurgePages({
    initial: null, pageSize: 40, maxPages: 6,
    fetch: async after => {
      const pos = after ? items.findIndex(i => i.cursor.id === after.id) + 1 : 0;
      return items.slice(pos, pos + 40);
    },
    handle: async () => ({ purged: 0, skipped: 40, failed: 0 }),
    checkpoint: async () => { checks++; },
    deadline: () => true,
  });
  assert.equal(scan.scanned, 40);
  assert.equal(scan.hasMore, true);
  assert.equal(checks, 1);
});

test('nanosecond timestamps use document IDs as stable tie breakers', async () => {
  const entries = [
    { cursor: { seconds: 1, nanos: 100, id: 'a' }, value: 'A' },
    { cursor: { seconds: 1, nanos: 100, id: 'b' }, value: 'B' },
    { cursor: { seconds: 1, nanos: 101, id: 'a' }, value: 'C' },
  ];
  let checkpoint = undefined;
  const scan = await scanPurgePages({
    initial: null, pageSize: 3, maxPages: 2,
    fetch: async after => after ? [] : entries,
    handle: async values => {
      assert.deepEqual(values, ['A', 'B', 'C']);
      return { purged: 1, skipped: 2, failed: 0 };
    },
    checkpoint: async next => { checkpoint = next; },
  });
  assert.equal(scan.scanned, 3);
  assert.equal(checkpoint, null);
});

test('an empty page resets persisted cursor without mutation', async () => {
  let checkpoint = undefined;
  const scan = await scanPurgePages({
    initial: { seconds: 10, nanos: 0, id: 'y' },
    pageSize: 3, maxPages: 2, fetch: async () => [],
    handle: async () => { throw Error('unexpected processing'); },
    checkpoint: async next => { checkpoint = next; },
  });
  assert.equal(scan.scanned, 0);
  assert.equal(checkpoint, null);
});

test('counter mismatches reject without persisting progress', async () => {
  let updates = 0;
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => ({ purged: 1, skipped: 0, failed: 0 }),
    checkpoint: async () => { updates++; },
  }), /counts_invalid/);
  assert.equal(updates, 0);
});
