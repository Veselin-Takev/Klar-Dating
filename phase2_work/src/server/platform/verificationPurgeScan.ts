/** Bounded and resumable verification purge scan; caller owns Firestore lease/checkpoint. */
export type PurgeCursor = { seconds: number; nanos: number; id: string };
export type PurgeItem<T> = { cursor: PurgeCursor; value: T };
export type PurgeFailureReason = 'decision_conflict' | 'invalid_record' | 'pending_decision' | 'processing_error';
export type PurgeFailure = { id: string; reason: PurgeFailureReason };
export type PurgePageResult = {
  purged: number; skipped: number; failed: number;
  failures?: PurgeFailure[];
};
export type PurgeScanResult = PurgePageResult & { scanned: number; pages: number; hasMore: boolean };

export function readPurgeCursor(value: unknown): PurgeCursor | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('purge_cursor_invalid');
  const v = value as Record<string, unknown>;
  if (typeof v.seconds !== 'number' || !Number.isSafeInteger(v.seconds) || v.seconds < 0 || v.seconds > 4102444800
    || typeof v.nanos !== 'number' || !Number.isSafeInteger(v.nanos) || v.nanos < 0 || v.nanos >= 1e9
    || typeof v.id !== 'string' || !v.id.length || v.id.length > 1500 || v.id.includes('/')) {
    throw Error('purge_cursor_invalid');
  }
  return { seconds: v.seconds, nanos: v.nanos, id: v.id };
}

function cursorOrder(a: PurgeCursor, b: PurgeCursor): number {
  if (a.seconds !== b.seconds) return a.seconds - b.seconds;
  if (a.nanos !== b.nanos) return a.nanos - b.nanos;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function scanPurgePages<T>(options: {
  initial: PurgeCursor | null;
  pageSize: number;
  maxPages: number;
  fetch: (after: PurgeCursor | null, size: number) => Promise<PurgeItem<T>[]>;
  handle: (items: T[]) => Promise<PurgePageResult>;
  checkpoint: (after: PurgeCursor | null, completed?: T[]) => Promise<void>;
  // Identify the canonical Firestore document for each processed page item.
  // Required for failure journaling to reject out-of-page / duplicate receipts.
  identifyItem?: (value: T) => string;
  // Must persist individual failure evidence AND cursor in one transaction, or throw.
  recordFailedPage?: (after: PurgeCursor | null, page: T[], failures: PurgeFailure[]) => Promise<void>;
  deadline?: () => boolean;
}): Promise<PurgeScanResult> {
  const { pageSize, maxPages } = options;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10) throw Error('purge_scan_limit_invalid');
  let cursor = readPurgeCursor(options.initial);
  const result = { scanned: 0, purged: 0, skipped: 0, failed: 0, pages: 0, hasMore: false };
  let failedEarlier = false;
  for (let n = 0; n < maxPages; n++) {
    if (options.deadline?.()) return { ...result, hasMore: true };
    const page = await options.fetch(cursor, pageSize);
    if (!Array.isArray(page) || page.length > pageSize) throw Error('purge_page_invalid');
    // An empty fetch can also consume the remaining budget. Never reset the
    // durable cursor after expiration, even when no artifacts were returned.
    if (options.deadline?.()) return { ...result, hasMore: true };
    if (!page.length) {
      await options.checkpoint(null);
      return { ...result, hasMore: failedEarlier };
    }
    let last = cursor;
    for (const item of page) {
      // A malformed adapter result must produce a stable, non-destructive
      // failure rather than an incidental TypeError while dereferencing it.
      if (!item || typeof item !== 'object' || !('cursor' in item)) throw Error('purge_page_invalid');
      const next = readPurgeCursor(item.cursor);
      if (!next || (last && cursorOrder(next, last) <= 0)) throw Error('purge_order_invalid');
      last = next;
    }
    const counts = await options.handle(page.map(item => item.value));
    if (!counts || ![counts.purged, counts.skipped, counts.failed].every(v => Number.isSafeInteger(v) && v >= 0)
      || counts.purged + counts.skipped + counts.failed !== page.length) throw Error('purge_counts_invalid');
    const values = page.map(item => item.value);
    const full = page.length === pageSize;
    const next = full ? last : null;
    if (counts.failed > 0) {
      if (!options.recordFailedPage) {
        // Preserve the original strict behavior for non-journaling callers.
        return { ...result, scanned: result.scanned + page.length,
          purged: result.purged + counts.purged, skipped: result.skipped + counts.skipped,
          failed: result.failed + counts.failed, pages: result.pages + 1, hasMore: true };
      }
      const failures = counts.failures;
      if (!Array.isArray(failures) || failures.length !== counts.failed
        || failures.some(item => !item || typeof item.id !== 'string'
          || !item.id.length || item.id.includes('/')
          || !['decision_conflict', 'invalid_record', 'pending_decision', 'processing_error'].includes(item.reason))
        || new Set(failures.map(item => item.id)).size !== failures.length) {
        throw Error('purge_failure_journal_invalid');
      }
      // The scanner must independently prove that every journaled failure
      // belongs to precisely this page before authorizing cursor advancement.
      // Do not rely solely on the adapter's callback to validate its own IDs.
      if (!options.identifyItem) throw Error('purge_failure_journal_binding_missing');
      const pageIds = new Set<string>();
      for (const value of values) {
        const id = options.identifyItem(value);
        if (typeof id !== 'string' || !id.length || id.length > 1500
          || id.includes('/') || pageIds.has(id)) {
          throw Error('purge_failure_journal_invalid');
        }
        pageIds.add(id);
      }
      if (failures.some(failure => !pageIds.has(failure.id))) {
        throw Error('purge_failure_journal_invalid');
      }
      // This callback atomically journals named failures and advances the
      // durable cursor. If that fails, no progress may be acknowledged.
      await options.recordFailedPage(next, values, failures);
      failedEarlier = true;
    } else {
      await options.checkpoint(next, values);
    }
    cursor = next;
    result.scanned += page.length;
    result.purged += counts.purged;
    result.skipped += counts.skipped;
    result.failed += counts.failed;
    result.pages++;
    if (!full) return { ...result, hasMore: failedEarlier };
  }
  return { ...result, hasMore: true };
}
