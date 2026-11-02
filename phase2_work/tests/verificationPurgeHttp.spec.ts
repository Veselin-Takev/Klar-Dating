// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { complianceSignature, createVerificationStoragePurgeRouter } from '../src/server/routes/complianceStorage';

const secret = 'k'.repeat(64);
const uid = 'secret-user-identifier';
const storagePath = `verification/${uid}/private-photo.jpg`;

type Fixture = {
  uid?: string;
  storagePath?: string;
  decidedAt: number;
  fotoLoeschenAb: Date;
  status: string;
  entscheidung: string;
  photoPurged?: unknown;
  legalHold?: unknown;
};

function candidate(): Fixture {
  const decidedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
  return {
    uid, storagePath, decidedAt, fotoLoeschenAb: new Date(decidedAt + 30 * 24 * 60 * 60 * 1000),
    status: 'approved', entscheidung: 'bestaetigt', photoPurged: false,
  };
}

async function invokePurge(options: {
  rows?: Fixture[];
  failures?: number[];
  signed?: boolean;
}) {
  const rows = options.rows ?? [candidate()];
  const deletions: Array<{ path: string; options: unknown }> = [];
  const receipts: unknown[] = [];
  let dbReads = 0;
  let metadataReads = 0;
  // Deterministic Firestore-style document cursor; the due dates are equal
  // and document ID provides a stable tie-breaker across scan pages.
  const queryFrom = (lastIndex: number): any => ({
    orderBy: () => queryFrom(lastIndex),
    startAfter: (cursor: { id: string }) => queryFrom(Number(cursor.id.split('-')[1])),
    limit: (count: number) => ({
      get: async () => {
        const docs = rows.slice(lastIndex + 1, lastIndex + 1 + count).map((row, offset) => ({
          id: `challenge-${lastIndex + 1 + offset}`, data: () => row,
        }));
        return { docs, empty: docs.length === 0 };
      },
    }),
  });
  const db = {
    collection: (_name: string) => ({
      where: () => queryFrom(-1),
      doc: (id: string) => ({
        id,
        get: async () => {
          dbReads++;
          return { exists: true, data: () => rows[Number(id.split('-')[1]) ?? 0] };
        },
      }),
    }),
    runTransaction: async (body: (tx: unknown) => Promise<void>) => body({
      get: async (ref: { id: string }) => ({
        exists: true, data: () => rows[Number(ref.id.split('-')[1]) ?? 0],
      }),
      update: (_ref: unknown, auditData: unknown) => { receipts.push(auditData); },
    }),
  };
  const bucket = {
    file: (path: string) => ({
      getMetadata: async () => {
        metadataReads++;
        return [{ generation: '2938' }] as const;
      },
      delete: async (deleteOptions: unknown) => {
        deletions.push({ path, options: deleteOptions });
        const rowIndex = rows.findIndex(row => row.storagePath === path);
        if (options.failures?.includes(rowIndex)) {
          throw new Error(`provider error contained sensitive ${uid}, ${storagePath}: 412`);
        }
      },
    }),
  };
  const app = express();
  app.use('/api/admin', createVerificationStoragePurgeRouter({
    getDb: () => db as any, getBucket: () => bucket as any,
  }));
  const server: Server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const port = (server.address() as AddressInfo).port;
    const timestamp = String(Date.now());
    const body = '{}';
    const signature = complianceSignature(`${timestamp}.${body}`, secret);
    const previous = process.env.COMPLIANCE_JOB_SECRET;
    process.env.COMPLIANCE_JOB_SECRET = secret;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/admin/purge-verification-storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': options.signed === false ? '0'.repeat(64) : signature,
        },
        body,
      });
      const text = await response.text();
      // Express sendStatus(401) returns plain text, not JSON. Do not let the
      // test parser hide the actual expected rejection or storage side effects.
      const bodyValue = response.headers.get('content-type')?.includes('application/json')
        ? JSON.parse(text) : null;
      return { status: response.status, body: bodyValue, rawBody: text, deletions, receipts, dbReads, metadataReads };
    } finally {
      if (previous === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
      else process.env.COMPLIANCE_JOB_SECRET = previous;
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe('P0 #202 signed photo purge HTTP acknowledgement', () => {
  it('reports 503 and no per-person or provider errors for 412 generation race', async () => {
    const result = await invokePurge({ failures: [0] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, code: 'verification_storage_purge_incomplete', processed: 1, failedCount: 1 });
    expect(result.deletions).toEqual([{ path: storagePath, options: { ifGenerationMatch: '2938' } }]);
    expect(result.receipts).toHaveLength(0);
    expect(result.rawBody).not.toContain(uid);
    expect(result.rawBody).not.toContain(storagePath);
    expect(result.rawBody).not.toContain('provider error');
    expect(result.rawBody).not.toContain('auditDigest');
  });

  it('fails the whole scheduled invocation on partial success, without false 200', async () => {
    const result = await invokePurge({ rows: [candidate(), { ...candidate(), storagePath: `verification/${uid}/second.jpg` }], failures: [1] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, processed: 2, purgedCount: 1, failedCount: 1 });
    expect(result.receipts).toHaveLength(1);
    expect(result.rawBody).not.toContain(uid);
  });

  it('acknowledges a complete decision-valid generation-fenced purge with bounded counts', async () => {
    const result = await invokePurge({});
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true, processed: 1, purgedCount: 1, skippedCount: 0, failedCount: 0, malformedCount: 0,
    });
    expect(result.receipts).toHaveLength(1);
    expect(result.deletions[0]?.options).toEqual({ ifGenerationMatch: '2938' });
  });

  it('fails closed if a due Firestore row is malformed instead of silently dropping it', async () => {
    const result = await invokePurge({ rows: [{ ...candidate(), uid: undefined }] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, code: 'verification_storage_purge_preflight_failed', scannedCount: 1, malformedCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
  });

  it('does not delete valid earlier photos when a later due record is malformed', async () => {
    const result = await invokePurge({ rows: [candidate(), { ...candidate(), uid: undefined }] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', scannedCount: 2, malformedCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
    expect(result.metadataReads).toBe(0);
  });

  it.each([
    ['string false', 'false'],
    ['number zero', 0],
    ['null', null],
    ['present undefined', undefined],
  ])('rejects malformed photoPurged %s across the entire due batch', async (label, marker) => {
    const result = await invokePurge({ rows: [
      candidate(),
      { ...candidate(), storagePath: `verification/${uid}/bad-${label}.jpg`, photoPurged: marker },
    ] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', invalidStateCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
    expect(result.metadataReads).toBe(0);
    expect(result.rawBody).not.toContain(uid);
  });

  it('rejects explicitly present undefined legal-hold metadata before any batch delete', async () => {
    const result = await invokePurge({ rows: [
      candidate(),
      { ...candidate(), storagePath: `verification/${uid}/unclear-hold.jpg`, legalHold: undefined },
    ] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', invalidStateCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
  });

  it('does not delete a shared object when two due records claim the same path', async () => {
    const result = await invokePurge({ rows: [candidate(), candidate()] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', duplicatePathCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
  });

  it('rejects an unexpected due pending decision before any GCS mutation', async () => {
    const result = await invokePurge({ rows: [candidate(), { ...candidate(), storagePath: `verification/${uid}/pending.jpg`, status: 'pending', entscheidung: 'pending' }] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', invalidStateCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
  });

  it('rejects contradictory due decision fields before any GCS mutation', async () => {
    const result = await invokePurge({ rows: [candidate(), { ...candidate(), storagePath: `verification/${uid}/conflict.jpg`, entscheidung: 'abgelehnt' }] });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'verification_storage_purge_preflight_failed', invalidStateCount: 1 });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
  });

  it('crosses the initial 100-row boundary and reaches a later due photo', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...candidate(), storagePath: `verification/${uid}/already-${i}.jpg`, photoPurged: true,
    }));
    rows.push({ ...candidate(), storagePath: `verification/${uid}/beyond-100.jpg` });
    const result = await invokePurge({ rows });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, processed: 101, purgedCount: 1, skippedCount: 100 });
    expect(result.deletions).toEqual([{
      path: `verification/${uid}/beyond-100.jpg`, options: { ifGenerationMatch: '2938' },
    }]);
    expect(result.receipts).toHaveLength(1);
  });

  it('does not delete a single object if the bounded due scan cannot prove completeness', async () => {
    const rows = Array.from({ length: 301 }, (_, i) => ({
      ...candidate(), storagePath: `verification/${uid}/photo-${i}.jpg`,
    }));
    const result = await invokePurge({ rows });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      ok: false, code: 'verification_storage_purge_scan_incomplete', scannedCount: 300,
    });
    expect(result.deletions).toHaveLength(0);
    expect(result.receipts).toHaveLength(0);
    expect(result.metadataReads).toBe(0);
    expect(result.rawBody).not.toContain(uid);
  });

  it('accepts the exact bounded page limit only after probing for a next page', async () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
      ...candidate(), storagePath: `verification/${uid}/purged-${i}.jpg`, photoPurged: true,
    }));
    const result = await invokePurge({ rows });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, processed: 300, purgedCount: 0, skippedCount: 300 });
    expect(result.deletions).toHaveLength(0);
  });

  it('rejects unsigned scheduler calls before accessing Firestore or Storage', async () => {
    const result = await invokePurge({ signed: false });
    expect(result.status).toBe(401);
    expect(result.deletions).toHaveLength(0);
    expect(result.dbReads).toBe(0);
    expect(result.metadataReads).toBe(0);
  });
});
