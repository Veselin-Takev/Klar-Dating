// @vitest-environment node
// Real Firestore Emulator integration. Never connects to live Google Cloud.
import { createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { createVerificationStoragePurgeRouter } from '../src/server/routes/complianceStorage';

const activeEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const secret = 'synthetic-retention-firestore-emulator-secret-2026';
const originalSecret = process.env.COMPLIANCE_JOB_SECRET;
const readyExpiry = Timestamp.fromDate(new Date('2026-08-01T00:00:00Z'));
const decidedAt = Timestamp.fromDate(new Date('2026-06-01T00:00:00Z'));
const servers: Server[] = [];
let app: App;
let db: Firestore;

async function serve(fileDelete: (path: string, options: unknown) => Promise<void>) {
  const router = createVerificationStoragePurgeRouter({
    getDb: () => db,
    getBucket: () => ({ file: path => ({ delete: options => fileDelete(path, options) }) }),
  });
  const http = express();
  http.use('/api/admin/purge-verification-storage',
    express.raw({ inflate: false, type: 'application/json', limit: '2kb' }));
  http.use(express.json({ inflate: false, strict: true, limit: '900kb' }));
  http.use('/api/admin', router);
  const server = http.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}

async function signedPurge(origin: string) {
  const body = '{}';
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
  const response = await fetch(origin + '/api/admin/purge-verification-storage', {
    method: 'POST', body,
    headers: {
      'content-type': 'application/json',
      'X-Klar-Compliance-Timestamp': timestamp,
      'X-Klar-Compliance-Signature': signature,
    },
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

beforeEach(async () => {
  if (!activeEmulator) return;
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = 'demo-klar';
  const expectedProject = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID]
    .filter(Boolean);
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]{2,5}$/.test(host)
    || expectedProject.some(id => id !== project)
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'
    || process.env.NODE_ENV === 'production') {
    throw new Error('Refusing live cloud / invalid Firestore Emulator target');
  }
  process.env.COMPLIANCE_JOB_SECRET = secret;
  // A unique named database prevents interference from other running suites,
  // including storage and account-deletion tests on the default database.
  const unique = randomUUID().replaceAll('-', '');
  app = initializeApp({ projectId: project }, 'retention-emulator-' + unique);
  db = getFirestore(app, 'retention_' + unique);
});

afterEach(async () => {
  if (originalSecret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
  else process.env.COMPLIANCE_JOB_SECRET = originalSecret;
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  })));
  if (db) await db.terminate();
  if (app) await deleteApp(app);
});

describe.runIf(activeEmulator)('A-15 – real Firestore Emulator pagination and atomic leases', () => {
  it('advances beyond 100 invalid events, deletes only the pinned 101st generation and resets after an empty page', async () => {
    const batch = db.batch();
    for (let i = 0; i < 100; i++) {
      const id = 'a' + String(i).padStart(3, '0');
      batch.set(db.collection('verification_events').doc(id), {
        fotoLoeschenAb: readyExpiry, uid: 'malformed-event-without-storage-path',
      });
    }
    batch.set(db.collection('verification_events').doc('z-pinned'), {
      fotoLoeschenAb: readyExpiry, uid: 'syntheticuid', decidedAt,
      storagePath: 'verification/syntheticuid/synthetic.jpg',
      storageGeneration: '123456789', entscheidung: 'abgelehnt', photoPurged: false,
    });
    await batch.commit();
    const deletions: Array<{ path: string; options: unknown }> = [];
    const origin = await serve(async (path, options) => {
      deletions.push({ path, options });
      expect(path).toBe('verification/syntheticuid/synthetic.jpg');
      expect(options).toEqual({ ifGenerationMatch: '123456789' });
    });
    const first = await signedPurge(origin);
    expect(first.status).toBe(503);
    expect(first.body.errors).toBe(100);
    const stateRef = db.doc('system/verification_photo_purge_cursor');
    expect((await stateRef.get()).data()?.cursorId).toBe('a099');
    expect(deletions).toHaveLength(0);

    const second = await signedPurge(origin);
    expect(second.status).toBe(200);
    expect(second.body.scanned).toBe(1);
    expect(second.body.purgedCount).toBe(1);
    expect(deletions).toHaveLength(1);
    expect((await db.collection('verification_events').doc('z-pinned').get()).data()?.photoPurged).toBe(true);
    expect((await stateRef.get()).data()?.cursorId).toBe('z-pinned');

    const third = await signedPurge(origin);
    expect(third.status).toBe(200);
    expect(third.body.scanned).toBe(0);
    expect((await stateRef.get()).data()?.cursorId).toBeNull();
  }, 60_000);


  it.each([404, 412])('does not audit GCS HTTP %i as a successful deletion', async code => {
    const ref = db.collection('verification_events').doc('gcs-error');
    await ref.set({
      fotoLoeschenAb: readyExpiry,
      uid: 'syntheticuid', decidedAt, storagePath: 'verification/syntheticuid/error.jpg',
      storageGeneration: '123456789', entscheidung: 'abgelehnt', photoPurged: false,
    });
    const deletions: Array<{path: string; generation: unknown}> = [];
    const origin = await serve(async (path, options) => {
      deletions.push({path, generation: (options as {ifGenerationMatch?: unknown})?.ifGenerationMatch});
      throw Object.assign(new Error('Simulated GCS refusal'), {code});
    });
    const first = await signedPurge(origin);
    expect(first.status).toBe(503);
    expect(first.body.ok).toBe(false);
    expect(first.body.purgedCount).toBe(0);
    expect(first.body.errors).toBe(1);
    expect(deletions).toEqual([{path:'verification/syntheticuid/error.jpg', generation:'123456789'}]);
    const record = (await ref.get()).data();
    expect(record?.photoPurged).toBe(false);
    expect(record?.auditDigest).toBeUndefined();
    // Error must not pin the first page forever: scan advances, then restarts.
    const stateRef = db.doc('system/verification_photo_purge_cursor');
    expect((await stateRef.get()).data()?.cursorId).toBe('gcs-error');
    const end = await signedPurge(origin);
    expect(end.status).toBe(200);
    expect(end.body.scanned).toBe(0);
    expect((await stateRef.get()).data()?.cursorId).toBeNull();
    const retry = await signedPurge(origin);
    expect(retry.status).toBe(503);
    expect(deletions).toHaveLength(2);
    expect((await ref.get()).data()?.photoPurged).toBe(false);
  });

  it('never invokes GCS for a held verification event', async () => {
    const ref = db.collection('verification_events').doc('legal-hold');
    await ref.set({
      fotoLoeschenAb: readyExpiry, uid: 'syntheticuid', decidedAt,
      storagePath: 'verification/syntheticuid/held.jpg',
      storageGeneration: '123456789', entscheidung: 'bestaetigt',
      photoPurged: false, legalHold: true,
    });
    let storageCalls = 0;
    const origin = await serve(async () => { storageCalls++; throw new Error('should not delete'); });
    const result = await signedPurge(origin);
    expect(result.status).toBe(503);
    expect(result.body.purgedCount).toBe(0);
    expect(result.body.errors).toBe(1);
    expect(storageCalls).toBe(0);
    expect((await ref.get()).data()?.photoPurged).toBe(false);
  });

  it('never infers a missing decision-time GCS generation from the live object', async () => {
    const ref = db.collection('verification_events').doc('no-generation');
    await ref.set({
      fotoLoeschenAb: readyExpiry, uid: 'syntheticuid', decidedAt,
      storagePath: 'verification/syntheticuid/old.jpg',
      entscheidung: 'abgelehnt', photoPurged: false,
    });
    let storageCalls = 0;
    const origin = await serve(async () => {storageCalls++;});
    const result = await signedPurge(origin);
    expect(result.status).toBe(503);
    expect(result.body.purgedCount).toBe(0);
    expect(result.body.errors).toBe(1);
    expect(storageCalls).toBe(0);
    expect((await ref.get()).data()?.auditDigest).toBeUndefined();
  });

  it('honors a competing live worker lease without querying or deleting data', async () => {
    await db.doc('system/verification_photo_purge_cursor').set({
      cursorAt: null, cursorId: null, leaseToken: 'a2d69550-7835-4a4b-b121-d3b0ab0a6fc1',
      leaseUntil: new Date(Date.now() + 120_000),
    });
    const origin = await serve(async () => { throw new Error('must not reach storage'); });
    const response = await signedPurge(origin);
    expect(response.status).toBe(202);
    expect(response.body.busy).toBe(true);
    expect((await db.doc('system/verification_photo_purge_cursor').get()).data()?.leaseToken)
      .toBe('a2d69550-7835-4a4b-b121-d3b0ab0a6fc1');
  });

  it('rejects corrupt persisted lease state without scanning or touching GCS', async () => {
    await db.doc('system/verification_photo_purge_cursor').set({
      cursorAt: null, cursorId: null,
      leaseToken: 'a2d69550-7835-4a4b-b121-d3b0ab0a6fc1',
      leaseUntil: 'broken-timestamp',
    });
    const origin = await serve(async () => { throw new Error('must not delete'); });
    const result = await signedPurge(origin);
    expect(result.status).toBe(503);
    expect((await db.doc('system/verification_photo_purge_cursor').get()).data()?.leaseUntil)
      .toBe('broken-timestamp');
  });

  it('rejects a damaged persisted keyset without modifying the lease or deleting files', async () => {
    await db.doc('system/verification_photo_purge_cursor').set({
      cursorAt: 'invalid-timestamp', cursorId: 'a099', leaseToken: null, leaseUntil: null,
    });
    const origin = await serve(async () => { throw new Error('must not delete'); });
    const response = await signedPurge(origin);
    expect(response.status).toBe(503);
    const saved = (await db.doc('system/verification_photo_purge_cursor').get()).data();
    expect(saved?.cursorId).toBe('a099');
    expect(saved?.leaseToken).toBeNull();
  });
});
