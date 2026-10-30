/** Bounded and resumable verification purge scan; caller owns Firestore lease/checkpoint. */
export type PurgeCursor = { seconds: number; nanos: number; id: string };
export type PurgeItem<T> = { cursor: PurgeCursor; value: T };
export type PurgePageResult = { purged: number; skipped: number; failed: number };
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
  checkpoint: (after: PurgeCursor | null) => Promise<void>;
  deadline?: () => boolean;
}): Promise<PurgeScanResult> {
  const { pageSize, maxPages } = options;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10) throw Error('purge_scan_limit_invalid');
  let cursor = readPurgeCursor(options.initial);
  const result = { scanned: 0, purged: 0, skipped: 0, failed: 0, pages: 0, hasMore: false };
  for (let n = 0; n < maxPages; n++) {
    if (n > 0 && options.deadline?.()) return { ...result, hasMore: true };
    const page = await options.fetch(cursor, pageSize);
    if (!Array.isArray(page) || page.length > pageSize) throw Error('purge_page_invalid');
    if (!page.length) { await options.checkpoint(null); return result; }
    let last = cursor;
    for (const item of page) {
      const next = readPurgeCursor(item.cursor);
      if (!next || (last && cursorOrder(next, last) <= 0)) throw Error('purge_order_invalid');
      last = next;
    }
    const counts = await options.handle(page.map(item => item.value));
    if (!counts || ![counts.purged, counts.skipped, counts.failed].every(v => Number.isSafeInteger(v) && v >= 0)
      || counts.purged + counts.skipped + counts.failed !== page.length) throw Error('purge_counts_invalid');
    const full = page.length === pageSize;
    cursor = full ? last : null;
    // Advance only after a completed page; repeat after a crashed page is safe.
    await options.checkpoint(cursor);
    result.scanned += page.length;
    result.purged += counts.purged;
    result.skipped += counts.skipped;
    result.failed += counts.failed;
    result.pages++;
    if (!full) return result;
  }
  return { ...result, hasMore: true };
}
