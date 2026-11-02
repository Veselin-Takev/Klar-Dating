// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  censusVerificationRetentionBacklog, isCanonicalVerificationOwnerPath, type CensusRow,
} from '../src/server/platform/verificationBacklogCensus';

const now = Date.parse('2026-11-01T00:00:00Z');
const day = 24 * 60 * 60 * 1000;

function row(index: number, extra: Record<string, unknown> = {}): CensusRow {
  return {
    id: `private-event-${index}`,
    data: {
      uid: 'private-owner',
      storagePath: `verification/private-owner/object-${index}.jpg`,
      fotoLoeschenAb: new Date(now - day),
      status: 'approved',
      entscheidung: 'bestaetigt',
      photoPurged: false,
      ...extra,
    },
  };
}

function reader(rows: CensusRow[]) {
  const requested: Array<{ after: number | undefined; limit: number }> = [];
  const read = async (after: number | undefined, limit: number) => {
    requested.push({ after, limit });
    const start = after === undefined ? 0 : after + 1;
    const pageRows = rows.slice(start, start + limit);
    return {
      rows: pageRows,
      lastCursor: pageRows.length > 0 ? start + pageRows.length - 1 : undefined,
    };
  };
  return { read, requested };
}

describe('P0 #202 read-only verification retention backlog census', () => {
  it('counts more than 1000 events without emitting UIDs, IDs or object paths', async () => {
    const rows = Array.from({ length: 1101 }, (_, i) => row(i));
    const { read, requested } = reader(rows);
    const result = await censusVerificationRetentionBacklog(read, { now, pageSize: 100, maxPages: 20 });
    expect(result).toMatchObject({
      scanned: 1101, pagesScanned: 12, complete: true, truncated: false,
      readOnly: true, consistency: 'non_atomic_paginated_read',
      dueByMarker: 1101, missingOrInvalidExpiry: 0,
      duplicatedObjectPaths: 0, invalidOwnerOrPath: 0,
    });
    expect(requested.length).toBe(12);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('verification/');
    expect(result).not.toHaveProperty('cursor');
    expect(result).not.toHaveProperty('rows');
  });

  it('tracks missing expiry, holds, undecided, already purged and cross-page duplicate paths', async () => {
    const rows = [
      row(0),
      row(1, { fotoLoeschenAb: undefined, status: 'pending', entscheidung: 'pending' }),
      row(2, { fotoLoeschenAb: new Date(now + day), legalHold: true }),
      row(3, { photoPurged: true, storagePath: 'verification/private-owner/object-0.jpg' }),
      row(4, { uid: 'other-owner', status: 'unknown', entscheidung: undefined }),
      row(5, { retentionHold: true, fotoLoeschenAb: { toMillis: () => now - day } }),
    ];
    const { read } = reader(rows);
    const result = await censusVerificationRetentionBacklog(read, { now, pageSize: 2, maxPages: 10 });
    expect(result).toMatchObject({
      scanned: 6, complete: true, dueByMarker: 4, futureByMarker: 1,
      missingOrInvalidExpiry: 1, alreadyPurged: 1,
      pendingOrUnknownDecision: 2, knownLegalHolds: 2,
      invalidOwnerOrPath: 1, duplicatedObjectPaths: 1,
    });
  });

  it('marks bounded scans incomplete with a non-destructive sentinel probe', async () => {
    const { read, requested } = reader(Array.from({ length: 1001 }, (_, i) => row(i)));
    const result = await censusVerificationRetentionBacklog(read, { now, pageSize: 100, maxPages: 3 });
    expect(result).toMatchObject({
      scanned: 300, pagesScanned: 3, complete: false, truncated: true,
    });
    expect(requested.at(-1)).toEqual({ after: 299, limit: 1 });
  });

  it('proves exact-boundary completion only after checking for an extra document', async () => {
    const { read } = reader(Array.from({ length: 300 }, (_, i) => row(i)));
    expect(await censusVerificationRetentionBacklog(read, { now, pageSize: 100, maxPages: 3 }))
      .toMatchObject({ scanned: 300, complete: true, truncated: false });
  });

  it('counts an empty collection without Storage or Firebase dependencies', async () => {
    const { read } = reader([]);
    expect(await censusVerificationRetentionBacklog(read, { now }))
      .toMatchObject({ scanned: 0, pagesScanned: 1, complete: true, truncated: false });
  });

  it('fails closed on duplicate IDs or unstable cursors without leaking an identifier', async () => {
    const duplicate = [row(0), row(1), { ...row(2), id: 'private-event-0' }];
    const { read } = reader(duplicate);
    await expect(censusVerificationRetentionBacklog(read, { now, pageSize: 2 }))
      .rejects.toThrow('verification_census_inconsistent_page');
    const frozen = async () => ({ rows: [row(0)], lastCursor: 0 });
    await expect(censusVerificationRetentionBacklog(frozen, { now, pageSize: 1, maxPages: 3 }))
      .rejects.toThrow();
  });

  it('rejects invalid bounds and overlarge pages rather than silently truncating', async () => {
    const { read } = reader([row(0)]);
    await expect(censusVerificationRetentionBacklog(read, { now, pageSize: 101 }))
      .rejects.toThrow('verification_census_invalid_configuration');
    await expect(censusVerificationRetentionBacklog(read, { now, maxPages: 0 }))
      .rejects.toThrow('verification_census_invalid_configuration');
    await expect(censusVerificationRetentionBacklog(async () => ({ rows: [row(0), row(1), row(2)] }), {
      now, pageSize: 2,
    })).rejects.toThrow('verification_census_invalid_read_page');
  });

  it('reports ambiguous legal-hold field types separately without treating them as confirmed holds', async () => {
    const candidates = [
      row(0, { legalHold: true }),
      row(1, { legalHold: false }),
      row(2, { legalHold: 'false' }),
      row(3, { retentionHold: 'true' }),
      row(4, { hold: null }),
      row(5, { hold: 1 }),
      row(6, { legalHold: true, hold: 'false' }),
      row(7, { retentionHold: undefined }),
    ];
    const { read } = reader(candidates);
    const counts = await censusVerificationRetentionBacklog(read, { now, pageSize: 3, maxPages: 5 });
    expect(counts).toMatchObject({
      scanned: 8, complete: true, knownLegalHolds: 2,
      invalidHoldIndicators: 5,
    });
    expect(JSON.stringify(counts)).not.toContain('private-owner');
    expect(counts).not.toHaveProperty('rows');
  });

  it('flags lexical path traversal, empty segments and ambiguous owners as invalid without exposing paths', async () => {
    const malicious = [
      { uid: 'private-owner', storagePath: 'verification/private-owner/../foreign.jpg' },
      { uid: 'private-owner', storagePath: 'verification/private-owner/./photo.jpg' },
      { uid: 'private-owner', storagePath: 'verification/private-owner//photo.jpg' },
      { uid: 'private-owner', storagePath: 'verification/private-owner/filename\\part.jpg' },
      { uid: 'private-owner', storagePath: 'verification/private-owner/' },
      { uid: 'private-owner', storagePath: 'verification/private-owner/photo.jpg\u0000' },
      { uid: 'private-owner/other', storagePath: 'verification/private-owner/other/photo.jpg' },
      { uid: '..', storagePath: 'verification/../photo.jpg' },
      { uid: 'private-owner ', storagePath: 'verification/private-owner /photo.jpg' },
      { uid: 'private-owner', storagePath: 'verification/other-owner/photo.jpg' },
    ];
    for (const malformed of malicious) {
      expect(isCanonicalVerificationOwnerPath(malformed.uid, malformed.storagePath)).toBe(false);
    }
    expect(isCanonicalVerificationOwnerPath('private-owner', 'verification/private-owner/folder/photo.jpg')).toBe(true);
    expect(isCanonicalVerificationOwnerPath('provider:user', 'verification/provider:user/photo.jpg')).toBe(true);
    const { read } = reader([
      ...malicious.map((record, i) => row(i, record)),
      row(99, { storagePath: 'verification/private-owner/nested/photo.jpg' }),
    ]);
    const result = await censusVerificationRetentionBacklog(read, { now, pageSize: 5, maxPages: 4 });
    expect(result).toMatchObject({ scanned: 11, invalidOwnerOrPath: 10, complete: true });
    expect(JSON.stringify(result)).not.toContain('private-owner');
    expect(JSON.stringify(result)).not.toContain('foreign.jpg');
  });

});
