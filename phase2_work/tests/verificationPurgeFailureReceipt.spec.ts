// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  scanPurgePages, type PurgeCursor, type PurgePageResult,
} from '../src/server/platform/verificationPurgeScan';

type Entry = { id: string };
const entry = (id: string, seconds: number) => ({
  cursor: { seconds, nanos: 0, id }, value: { id },
});
const fail = (id: string): PurgePageResult => ({
  purged: 0, skipped: 1, failed: 1,
  failures: [{ id, reason: 'invalid_record' }],
});
const identify = (doc: Entry) => doc.id;

describe('verification purge failure receipt bound to fetched page', () => {
  it('journals a real poison-pill and advances to the subsequent valid page without false success', async () => {
    const first = [entry('bad', 10), entry('good-1', 11)];
    const second = [entry('good-2', 12)];
    const journal: { cursor: PurgeCursor | null; ids: string[] }[] = [];
    const checkpoints: (PurgeCursor | null)[] = [];
    const handled: string[] = [];
    const result = await scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async after => after ? second : first,
      handle: async items => {
        handled.push(...items.map(item => item.id));
        return items.some(item => item.id === 'bad')
          ? fail('bad') : { purged: 0, skipped: items.length, failed: 0 };
      },
      identifyItem: identify,
      recordFailedPage: async (cursor, items, failures) => {
        expect(items).toHaveLength(2);
        expect(failures).toEqual([{ id: 'bad', reason: 'invalid_record' }]);
        journal.push({ cursor, ids: failures.map(f => f.id) });
      },
      checkpoint: async cursor => { checkpoints.push(cursor); },
    });
    expect(handled).toEqual(['bad', 'good-1', 'good-2']);
    expect(journal).toEqual([{
      cursor: { seconds: 11, nanos: 0, id: 'good-1' },
      ids: ['bad'],
    }]);
    expect(checkpoints).toEqual([null]);
    expect(result).toMatchObject({
      scanned: 3, skipped: 2, failed: 1, pages: 2, hasMore: true,
    });
  });

  it('rejects a forged out-of-page failure ID before any durable write', async () => {
    let journalWrites = 0;
    let checkpointWrites = 0;
    await expect(scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async () => [entry('actual', 10), entry('other', 11)],
      handle: async () => fail('unrelated-document'),
      identifyItem: identify,
      recordFailedPage: async () => { journalWrites++; },
      checkpoint: async () => { checkpointWrites++; },
    })).rejects.toThrow('purge_failure_journal_invalid');
    expect(journalWrites).toBe(0);
    expect(checkpointWrites).toBe(0);
  });

  it('rejects duplicate page IDs even when cursor timestamps are increasing', async () => {
    let journalWrites = 0;
    await expect(scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async () => [entry('same', 10), entry('same', 11)],
      handle: async () => fail('same'),
      identifyItem: identify,
      recordFailedPage: async () => { journalWrites++; },
      checkpoint: async () => { throw Error('unexpected_checkpoint'); },
    })).rejects.toThrow('purge_failure_journal_invalid');
    expect(journalWrites).toBe(0);
  });

  it('requires an ID resolver for any failure-journal caller', async () => {
    let journalWrites = 0;
    await expect(scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async () => [entry('bad', 10), entry('good', 11)],
      handle: async () => fail('bad'),
      recordFailedPage: async () => { journalWrites++; },
      checkpoint: async () => { throw Error('unexpected_checkpoint'); },
    })).rejects.toThrow('purge_failure_journal_binding_missing');
    expect(journalWrites).toBe(0);
  });

  it('preserves strict no-progress behavior if no atomic journal exists', async () => {
    let checkpointWrites = 0;
    const result = await scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async () => [entry('bad', 10), entry('good', 11)],
      handle: async () => fail('bad'),
      checkpoint: async () => { checkpointWrites++; },
    });
    expect(result).toMatchObject({ scanned: 2, failed: 1, hasMore: true });
    expect(checkpointWrites).toBe(0);
  });

  it('does not require failure-item identity for an entirely clean scan', async () => {
    let journalWrites = 0;
    let checkpointWrites = 0;
    const result = await scanPurgePages<Entry>({
      initial: null, pageSize: 2, maxPages: 2,
      fetch: async () => [entry('healthy', 10)],
      handle: async items => ({ purged: 0, skipped: items.length, failed: 0 }),
      recordFailedPage: async () => { journalWrites++; },
      checkpoint: async cursor => { expect(cursor).toBeNull(); checkpointWrites++; },
    });
    expect(result).toMatchObject({ scanned: 1, failed: 0, hasMore: false });
    expect(journalWrites).toBe(0);
    expect(checkpointWrites).toBe(1);
  });
});
