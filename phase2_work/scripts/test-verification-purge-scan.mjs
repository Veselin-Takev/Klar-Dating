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

test('individual failures report retryable counts without checkpointing past artifacts', async () => {
  let cursor = null;
  let checkpoints = 0;
  const result = await scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => ({ purged: 0, skipped: 1, failed: 1 }),
    checkpoint: async next => { cursor = next; checkpoints++; },
  });
  assert.deepEqual({ scanned: result.scanned, failed: result.failed, skipped: result.skipped,
    pages: result.pages, hasMore: result.hasMore },
  { scanned: 2, failed: 1, skipped: 1, pages: 1, hasMore: true });
  assert.equal(checkpoints, 0);
  assert.equal(cursor, null);
});

test('a later failed page retains only the previous successful checkpoint', async () => {
  let cursor = null;
  const checkpoints = [];
  const pages = [];
  const result = await scanPurgePages({
    initial: null, pageSize: 2, maxPages: 3,
    fetch: async after => after ? items.slice(2, 4) : items.slice(0, 2),
    handle: async values => {
      pages.push(values);
      return pages.length === 1
        ? { purged: 2, skipped: 0, failed: 0 }
        : { purged: 0, skipped: 1, failed: 1 };
    },
    checkpoint: async next => { cursor = next; checkpoints.push(next); },
  });
  assert.equal(result.scanned, 4);
  assert.equal(result.purged, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.hasMore, true);
  assert.equal(result.pages, 2);
  assert.equal(checkpoints.length, 1);
  assert.equal(cursor.id, 'id1');
});

test('a partial final page with a failed item must not reset the checkpoint', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  let persisted = previous;
  let writes = 0;
  const result = await scanPurgePages({
    initial: previous, pageSize: 5, maxPages: 2,
    fetch: async after => {
      assert.deepEqual(after, previous);
      return items.slice(2, 4);
    },
    handle: async () => ({ purged: 1, skipped: 0, failed: 1 }),
    checkpoint: async next => { persisted = next; writes++; },
  });
  assert.equal(result.scanned, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.hasMore, true);
  assert.equal(writes, 0);
  assert.deepEqual(persisted, previous);
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

test('an already expired deadline blocks the initial fetch and preserves checkpoint', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  let fetches = 0;
  let writes = 0;
  const result = await scanPurgePages({
    initial: previous, pageSize: 2, maxPages: 2,
    fetch: async () => { fetches++; return items.slice(2, 4); },
    handle: async () => { throw Error('deadline bypassed'); },
    checkpoint: async () => { writes++; },
    deadline: () => true,
  });
  assert.deepEqual(result, {
    scanned: 0, purged: 0, skipped: 0, failed: 0, pages: 0, hasMore: true,
  });
  assert.equal(fetches, 0);
  assert.equal(writes, 0);
});

test('deadline expiry during fetch prevents starting destructive page handling', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  let expired = false;
  let handled = 0;
  let checkpoints = 0;
  const result = await scanPurgePages({
    initial: previous, pageSize: 2, maxPages: 2,
    fetch: async () => { expired = true; return items.slice(2, 4); },
    handle: async () => { handled++; return { purged: 2, skipped: 0, failed: 0 }; },
    checkpoint: async () => { checkpoints++; },
    deadline: () => expired,
  });
  assert.equal(result.scanned, 0);
  assert.equal(result.hasMore, true);
  assert.equal(handled, 0);
  assert.equal(checkpoints, 0);
});

test('expired deadline during empty fetch preserves the durable cursor', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  let expired = false;
  let writes = 0;
  const result = await scanPurgePages({
    initial: previous, pageSize: 2, maxPages: 2,
    fetch: async () => { expired = true; return []; },
    handle: async () => { throw Error('unexpected processing'); },
    checkpoint: async () => { writes++; },
    deadline: () => expired,
  });
  assert.equal(result.scanned, 0);
  assert.equal(result.hasMore, true);
  assert.equal(writes, 0);
});

test('a deadline is respected after a complete page checkpoint', async () => {
  let checks = 0;
  let deadlineChecks = 0;
  const scan = await scanPurgePages({
    initial: null, pageSize: 40, maxPages: 6,
    fetch: async after => {
      const pos = after ? items.findIndex(i => i.cursor.id === after.id) + 1 : 0;
      return items.slice(pos, pos + 40);
    },
    handle: async () => ({ purged: 0, skipped: 40, failed: 0 }),
    checkpoint: async () => { checks++; },
    deadline: () => ++deadlineChecks > 2,
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

test('duplicate cursor rows reject before handling or checkpointing', async () => {
  let handled = 0;
  let checkpoints = 0;
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => [items[0], items[0]],
    handle: async () => { handled++; return { purged: 2, skipped: 0, failed: 0 }; },
    checkpoint: async () => { checkpoints++; },
  }), /purge_order_invalid/);
  assert.equal(handled, 0);
  assert.equal(checkpoints, 0);
});

test('checkpoint persistence failure is propagated and never reported as success', async () => {
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => items.slice(0, 2),
    handle: async () => ({ purged: 2, skipped: 0, failed: 0 }),
    checkpoint: async () => { throw Error('checkpoint_write_unavailable'); },
  }), /checkpoint_write_unavailable/);
});

test('empty-page checkpoint failure is propagated', async () => {
  await assert.rejects(scanPurgePages({
    initial: { seconds: 10, nanos: 0, id: 'a' },
    pageSize: 2, maxPages: 1,
    fetch: async () => [],
    handle: async () => { throw Error('unexpected handling'); },
    checkpoint: async () => { throw Error('checkpoint_reset_unavailable'); },
  }), /checkpoint_reset_unavailable/);
});

test('invalid scan limits reject before any fetch or destructive handling', async () => {
  let calls = 0;
  for (const [pageSize, maxPages] of [[0, 1], [101, 1], [1, 0], [1, 11], [NaN, 1], [1, Infinity]]) {
    await assert.rejects(scanPurgePages({
      initial: null, pageSize, maxPages,
      fetch: async () => { calls++; return []; },
      handle: async () => { calls++; return { purged: 0, skipped: 0, failed: 0 }; },
      checkpoint: async () => { calls++; },
    }), /purge_scan_limit_invalid/);
  }
  assert.equal(calls, 0);
});

test('invalid result counters reject without checkpointing', async () => {
  for (const invalid of [
    { purged: NaN, skipped: 1, failed: 0 },
    { purged: -1, skipped: 3, failed: 0 },
    { purged: 1.5, skipped: 0.5, failed: 0 },
    { purged: 1, skipped: 0, failed: Infinity },
  ]) {
    let writes = 0;
    await assert.rejects(scanPurgePages({
      initial: null, pageSize: 2, maxPages: 1,
      fetch: async () => items.slice(0, 2),
      handle: async () => invalid,
      checkpoint: async () => { writes++; },
    }), /purge_counts_invalid/);
    assert.equal(writes, 0);
  }
});

test('malformed persisted cursors fail before querying or checkpointing', async () => {
  const invalid = [
    { seconds: -1, nanos: 0, id: 'x' },
    { seconds: 4102444801, nanos: 0, id: 'x' },
    { seconds: 1, nanos: 1e9, id: 'x' },
    { seconds: 1.5, nanos: 0, id: 'x' },
    { seconds: 1, nanos: 0, id: '' },
    { seconds: 1, nanos: 0, id: 'folder/file' },
    { seconds: 1, nanos: 0, id: 'x'.repeat(1501) },
    [],
    'not-a-cursor',
  ];
  let sideEffects = 0;
  for (const initial of invalid) {
    await assert.rejects(scanPurgePages({
      initial, pageSize: 2, maxPages: 1,
      fetch: async () => { sideEffects++; return []; },
      handle: async () => { sideEffects++; return { purged: 0, skipped: 0, failed: 0 }; },
      checkpoint: async () => { sideEffects++; },
    }), /purge_cursor_invalid/);
  }
  assert.equal(sideEffects, 0);
});

test('invalid fetched cursor rejects before destructive handling or checkpointing', async () => {
  let sideEffects = 0;
  await assert.rejects(scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => [{ cursor: { seconds: 1, nanos: 0, id: 'a/b' }, value: 'unsafe' }],
    handle: async () => { sideEffects++; return { purged: 0, skipped: 1, failed: 0 }; },
    checkpoint: async () => { sideEffects++; },
  }), /purge_cursor_invalid/);
  assert.equal(sideEffects, 0);
});

test('replayed or backward cursor relative to persisted checkpoint is rejected', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  for (const stale of [items[0], items[1]]) {
    let handled = 0;
    let checkpoints = 0;
    await assert.rejects(scanPurgePages({
      initial: previous, pageSize: 2, maxPages: 1,
      fetch: async after => { assert.deepEqual(after, previous); return [stale]; },
      handle: async () => { handled++; return { purged: 0, skipped: 1, failed: 0 }; },
      checkpoint: async () => { checkpoints++; },
    }), /purge_order_invalid/);
    assert.equal(handled, 0);
    assert.equal(checkpoints, 0);
  }
});

test('successful short page resets persisted checkpoint after processing', async () => {
  const previous = { seconds: 101, nanos: 0, id: 'id1' };
  const writes = [];
  const result = await scanPurgePages({
    initial: previous, pageSize: 5, maxPages: 2,
    fetch: async after => { assert.deepEqual(after, previous); return items.slice(2, 4); },
    handle: async values => {
      assert.deepEqual(values, [2, 3]);
      return { purged: 1, skipped: 1, failed: 0 };
    },
    checkpoint: async cursor => { writes.push(cursor); },
  });
  assert.deepEqual(writes, [null]);
  assert.deepEqual(result, { scanned: 2, purged: 1, skipped: 1, failed: 0, pages: 1, hasMore: false });
});

test('malformed fetched page rows fail with stable error before any destructive side effects', async () => {
  for (const row of [null, undefined, 42, 'invalid', {}, { value: 'missing-cursor' }]) {
    let handled = 0;
    let checkpoints = 0;
    await assert.rejects(scanPurgePages({
      initial: null, pageSize: 1, maxPages: 1,
      fetch: async () => [row],
      handle: async () => { handled++; return { purged: 0, skipped: 1, failed: 0 }; },
      checkpoint: async () => { checkpoints++; },
    }), /purge_page_invalid/);
    assert.equal(handled, 0);
    assert.equal(checkpoints, 0);
  }
});

test('a non-array fetch result is rejected before processing or checkpointing', async () => {
  for (const malformed of [null, undefined, {}, 'unexpected', 7]) {
    let sideEffects = 0;
    await assert.rejects(scanPurgePages({
      initial: null, pageSize: 2, maxPages: 1,
      fetch: async () => malformed,
      handle: async () => { sideEffects++; return { purged: 0, skipped: 0, failed: 0 }; },
      checkpoint: async () => { sideEffects++; },
    }), /purge_page_invalid/);
    assert.equal(sideEffects, 0);
  }
});

test('a fetch error propagates without advancing the checkpoint', async () => {
  let sideEffects = 0;
  await assert.rejects(scanPurgePages({
    initial: { seconds: 101, nanos: 0, id: 'id1' },
    pageSize: 2, maxPages: 1,
    fetch: async () => { throw Error('firestore_query_unavailable'); },
    handle: async () => { sideEffects++; return { purged: 0, skipped: 0, failed: 0 }; },
    checkpoint: async () => { sideEffects++; },
  }), /firestore_query_unavailable/);
  assert.equal(sideEffects, 0);
});

test('exactly full final page requires an empty follow-up fetch before declaring completion', async () => {
  const checkpoints = [];
  let fetches = 0;
  const result = await scanPurgePages({
    initial: null, pageSize: 2, maxPages: 3,
    fetch: async after => {
      fetches++;
      return after ? [] : items.slice(0, 2);
    },
    handle: async values => {
      assert.deepEqual(values, [0, 1]);
      return { purged: 1, skipped: 1, failed: 0 };
    },
    checkpoint: async cursor => { checkpoints.push(cursor); },
  });
  assert.equal(fetches, 2);
  assert.equal(checkpoints.length, 2);
  assert.deepEqual(checkpoints[0], items[1].cursor);
  assert.equal(checkpoints[1], null);
  assert.deepEqual(result, { scanned: 2, purged: 1, skipped: 1, failed: 0, pages: 1, hasMore: false });
});

test('full page at invocation budget keeps a durable resume cursor and hasMore flag', async () => {
  const checkpoints = [];
  let fetches = 0;
  const result = await scanPurgePages({
    initial: null, pageSize: 2, maxPages: 1,
    fetch: async () => { fetches++; return items.slice(0, 2); },
    handle: async () => ({ purged: 2, skipped: 0, failed: 0 }),
    checkpoint: async cursor => { checkpoints.push(cursor); },
  });
  assert.equal(fetches, 1);
  assert.deepEqual(checkpoints, [items[1].cursor]);
  assert.deepEqual(result, { scanned: 2, purged: 2, skipped: 0, failed: 0, pages: 1, hasMore: true });
});
