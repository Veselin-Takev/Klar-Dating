// @vitest-environment node
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { createVerificationStoragePurgeRouter, readVerificationPurgeCursor } from '../src/server/routes/complianceStorage';

const secret = 'synthetic-compliance-cursor-test-secret-12345';
const priorSecret = process.env.COMPLIANCE_JOB_SECRET;
const servers: Server[] = [];
beforeEach(() => { process.env.COMPLIANCE_JOB_SECRET = secret; });
afterEach(async () => {
  if (priorSecret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
  else process.env.COMPLIANCE_JOB_SECRET = priorSecret;
  await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => {
    s.close(() => resolve()); s.closeAllConnections();
  })));
});

type Entry = { id: string; expires: Timestamp; fields: Record<string, unknown> };
function database(entries: Entry[]) {
  const state: Record<string, unknown> = {};
  let failing = false;
  let fetchedPages = 0;
  const stateRef = { path: 'system/verification_photo_purge_cursor' };
  const database = {
    doc: () => stateRef,
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => ({ ...state }) }),
      set: (_ref: unknown, value: Record<string, unknown>) => Object.assign(state, value),
      update: () => { throw new Error('Unexpected update in synthetic cursor test'); },
    }),
    collection: (name: string) => {
      if (name !== 'verification_events') throw new Error('Unexpected collection: ' + name);
      const query = {
        cursor: null as null | { at: Timestamp; id: string },
        upperBound: Infinity,
        max: 100,
        where(_field: string, _op: string, cutoff: Date) { this.upperBound = cutoff.getTime(); return this; },
        orderBy() { return this; },
        startAfter(at: Timestamp, id: string) { this.cursor = { at, id }; return this; },
        limit(n: number) { this.max = n; return this; },
        async get() {
          if (failing) throw new Error('Simulated Firestore outage');
          fetchedPages++;
          const sorted = [...entries].filter(x => x.expires.toMillis() <= this.upperBound).sort((a, b) =>
            a.expires.seconds - b.expires.seconds || a.expires.nanoseconds - b.expires.nanoseconds || a.id.localeCompare(b.id));
          const after = sorted.filter(x => {
            if (!this.cursor) return true;
            const { at, id } = this.cursor;
            return x.expires.seconds > at.seconds
              || (x.expires.seconds === at.seconds && (x.expires.nanoseconds > at.nanoseconds
                || (x.expires.nanoseconds === at.nanoseconds && x.id > id)));
          });
          const docs = after.slice(0, this.max).map(x => ({
            id: x.id, data: () => x.fields, get: (name: string) => name === 'fotoLoeschenAb' ? x.expires : undefined,
          }));
          return { docs };
        },
      };
      return query;
    },
  };
  return {
    db: database as unknown as Firestore,
    state,
    get fetchedPages() { return fetchedPages; },
    failQuery: (failure: boolean) => { failing = failure; },
  };
}

async function origin(db: Firestore) {
  const app = express();
  app.use('/api/admin/purge-verification-storage',
    express.raw({ inflate: false, type: 'application/json', limit: '2kb' }));
  app.use(express.json({ inflate: false, strict: true, limit: '900kb' }));
  app.use('/api/admin', createVerificationStoragePurgeRouter({ getDb: () => db,
    getBucket: () => ({ file: () => ({ delete: async () => { throw new Error('Unexpected GCS delete'); } }) }) }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}
async function run(base: string) {
  const timestamp = String(Date.now());
  const body = '{}';
  const signature = createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
  const response = await fetch(base + '/api/admin/purge-verification-storage', { method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Klar-Compliance-Timestamp': timestamp,
      'X-Klar-Compliance-Signature': signature }, body });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
const expiry = Timestamp.fromDate(new Date('2026-08-01T12:00:00.000Z'));

describe('A-15 persistent pagination and liveness', () => {
  it('scans past 100 malformed/held events to later eligible events and restarts after empty page', async () => {
    // Identical expiry forces deterministic tie-break on document ID.
    const entries: Entry[] = Array.from({ length: 100 }, (_, i) => ({
      id: 'a' + String(i).padStart(3, '0'), expires: expiry,
      fields: { uid: 'invalid-without-owner-bound-path' },
    }));
    entries.push({ id: 'z-eligible', expires: expiry,
      fields: { uid: 'u1', storagePath: 'verification/u1/old.jpg',
        entschiedenAm: new Date('2026-07-01T00:00:00Z'),
        decidedAt: new Date('2026-07-01T00:00:00Z'),
        entscheidung: 'abgelehnt', photoPurged: true } });
    const fake = database(entries), base = await origin(fake.db);
    const first = await run(base);
    expect(first.status).toBe(503);
    expect(first.body.errors).toBe(100);
    expect(first.body.scanned).toBe(100);
    expect(fake.state.cursorId).toBe('a099');
    const second = await run(base);
    expect(second.status).toBe(200);
    expect(second.body.scanned).toBe(1);
    expect(second.body.processed).toBe(1);
    expect(fake.state.cursorId).toBe('z-eligible');
    const third = await run(base);
    expect(third.status).toBe(200);
    expect(third.body.scanned).toBe(0);
    expect(fake.state.cursorAt).toBeNull();
    expect(fake.state.cursorId).toBeNull();
    const fourth = await run(base);
    expect(fourth.status).toBe(503);
    expect(fourth.body.scanned).toBe(100);
  });

  it('refuses malformed persisted cursor rather than silently replaying first page', async () => {
    const fake = database([]);
    fake.state.cursorId = 'docA';
    fake.state.cursorAt = 'not a Firestore timestamp';
    const base = await origin(fake.db), result = await run(base);
    expect(result.status).toBe(503);
    expect(fake.fetchedPages).toBe(0);
  });

  it('blocks competing workers while the lease is valid', async () => {
    const fake = database([]);
    fake.state.leaseToken = 'other-worker';
    fake.state.leaseUntil = new Date(Date.now() + 60_000);
    const base = await origin(fake.db), result = await run(base);
    expect(result.status).toBe(202);
    expect(result.body.busy).toBe(true);
    expect(fake.fetchedPages).toBe(0);
  });

  it('preserves checkpoint after Firestore read failure and releases owned lease', async () => {
    const fake = database([]);
    fake.state.cursorAt = expiry;
    fake.state.cursorId = 'checkpoint';
    fake.failQuery(true);
    const base = await origin(fake.db), failed = await run(base);
    expect(failed.status).toBe(503);
    expect(fake.state.cursorId).toBe('checkpoint');
    expect(fake.state.leaseToken).toBeNull();
    fake.failQuery(false);
    const recovered = await run(base);
    expect(recovered.status).toBe(200);
    expect(recovered.body.scanned).toBe(0);
    expect(fake.state.cursorId).toBeNull();
  });

  it('validates nanosecond timestamp and document-ID cursor shape', () => {
    expect(readVerificationPurgeCursor({ cursorAt: null, cursorId: null })).toBeNull();
    expect(readVerificationPurgeCursor({ cursorAt: expiry, cursorId: 'valid-id' })?.id).toBe('valid-id');
    expect(readVerificationPurgeCursor({ cursorAt: expiry, cursorId: 'custom.identifier:01' })?.id).toBe('custom.identifier:01');
    expect(() => readVerificationPurgeCursor({ cursorAt: { seconds: 1, nanoseconds: 1_000_000_000 }, cursorId: 'id' }))
      .toThrow('INVALID_VERIFICATION_PURGE_CURSOR');
    expect(() => readVerificationPurgeCursor({ cursorAt: expiry, cursorId: 'invalid/path' }))
      .toThrow('INVALID_VERIFICATION_PURGE_CURSOR');
  });
});
