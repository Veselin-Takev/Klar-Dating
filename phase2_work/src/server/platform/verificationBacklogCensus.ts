/**
 * P0 #202: pure read-only verification retention census contract.
 *
 * Caller supplies deterministic, document-ID ordered read pages. Neither this
 * module nor its result contains Firestore/GCS mutation capabilities, IDs,
 * object paths, source fields, or a checkpoint that could authorize purging.
 * Pages are NOT an atomic snapshot under concurrent source mutations.
 */
export interface CensusRow {
  id: string;
  data: Record<string, unknown>;
}
export interface CensusPage<Cursor> {
  rows: readonly CensusRow[];
  /** Opaque in-memory read cursor; never exposed in aggregate output. */
  lastCursor?: Cursor;
}
export interface CensusCounts {
  scanned: number;
  pagesScanned: number;
  complete: boolean;
  truncated: boolean;
  consistency: 'non_atomic_paginated_read';
  readOnly: true;
  alreadyPurged: number;
  missingOrInvalidExpiry: number;
  dueByMarker: number;
  futureByMarker: number;
  pendingOrUnknownDecision: number;
  knownLegalHolds: number;
  invalidOwnerOrPath: number;
  duplicatedObjectPaths: number;
}

type PageReader<Cursor> = (after: Cursor | undefined, limit: number) => Promise<CensusPage<Cursor>>;

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  if (value !== null && typeof value === 'object' && 'toMillis' in value &&
    typeof value.toMillis === 'function') {
    const result = value.toMillis();
    return typeof result === 'number' && Number.isFinite(result) && result > 0 ? result : null;
  }
  return null;
}

function knownDecision(value: unknown): 'approved' | 'rejected' | 'pending' | null {
  if (value === 'approved' || value === 'bestaetigt') return 'approved';
  if (value === 'rejected' || value === 'abgelehnt') return 'rejected';
  if (value === 'pending' || value === 'ausstehend') return 'pending';
  return null;
}

export async function censusVerificationRetentionBacklog<Cursor>(
  readPage: PageReader<Cursor>,
  options: { now: number; pageSize?: number; maxPages?: number },
): Promise<CensusCounts> {
  const { now, pageSize = 100, maxPages = 20 } = options;
  if (typeof readPage !== 'function' || !Number.isSafeInteger(now) || now <= 0 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 100) {
    throw new Error('verification_census_invalid_configuration');
  }
  const output: CensusCounts = {
    scanned: 0, pagesScanned: 0, complete: false, truncated: false,
    consistency: 'non_atomic_paginated_read', readOnly: true,
    alreadyPurged: 0, missingOrInvalidExpiry: 0,
    dueByMarker: 0, futureByMarker: 0, pendingOrUnknownDecision: 0,
    knownLegalHolds: 0, invalidOwnerOrPath: 0, duplicatedObjectPaths: 0,
  };
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  let cursor: Cursor | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const page = await readPage(cursor, pageSize);
    if (!page || !Array.isArray(page.rows) || page.rows.length > pageSize) {
      throw new Error('verification_census_invalid_read_page');
    }
    output.pagesScanned++;
    for (const row of page.rows) {
      if (!row || typeof row.id !== 'string' || !row.id ||
          seenIds.has(row.id) || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
        // Duplicate IDs can indicate unstable cursors or concurrent page drift.
        // Reject rather than silently over-count or claim a trustworthy census.
        throw new Error('verification_census_inconsistent_page');
      }
      seenIds.add(row.id);
      const record = row.data;
      output.scanned++;
      const expiry = timeMs(record.fotoLoeschenAb);
      if (expiry === null) output.missingOrInvalidExpiry++;
      else if (expiry <= now) output.dueByMarker++;
      else output.futureByMarker++;
      if (record.photoPurged === true) output.alreadyPurged++;
      const primary = knownDecision(record.entscheidung);
      const secondary = knownDecision(record.status);
      if ((!primary && !secondary) ||
          (record.entscheidung !== undefined && !primary) ||
          (record.status !== undefined && !secondary) ||
          (primary !== null && secondary !== null && primary !== secondary) ||
          (primary ?? secondary) === 'pending') {
        output.pendingOrUnknownDecision++;
      }
      if (record.legalHold === true || record.retentionHold === true || record.hold === true) {
        output.knownLegalHolds++;
      }
      const uid = record.uid, path = record.storagePath;
      if (typeof uid !== 'string' || !uid ||
          typeof path !== 'string' || !path.startsWith(`verification/${uid}/`)) {
        output.invalidOwnerOrPath++;
      }
      if (typeof path === 'string' && path) {
        if (seenPaths.has(path)) output.duplicatedObjectPaths++;
        seenPaths.add(path);
      }
    }
    if (page.rows.length < pageSize) {
      output.complete = true;
      return output;
    }
    if (page.lastCursor == null || page.lastCursor === cursor) {
      throw new Error('verification_census_missing_progress_cursor');
    }
    cursor = page.lastCursor;
  }

  // One extra read, no IDs emitted: a full final page does not by itself
  // prove complete coverage. Never silently classify a truncated scan PASS.
  const sentinel = await readPage(cursor, 1);
  if (!sentinel || !Array.isArray(sentinel.rows) || sentinel.rows.length > 1) {
    throw new Error('verification_census_invalid_probe');
  }
  output.complete = sentinel.rows.length === 0;
  output.truncated = !output.complete;
  return output;
}
