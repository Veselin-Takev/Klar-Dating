// @vitest-environment node
// Strictly local emulator integration: signed HTTP route, distributed Firestore
// lease, retryable Storage failure and audit receipt. No actual Storage deletes.
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import express from 'express';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  complianceSignature, createVerificationStoragePurgeRouter,
} from '../src/server/routes/complianceStorage';

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const active = Boolean(emulator);
if (active || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const configPath = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const local = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(emulator);
  const projects = [
    process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID,
  ].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || projects.some(p => p !== 'demo-klar')
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw Error('verification_purge_http_emulator_unsafe_target');
  }
}

const secret = 'emulator-only-'.padEnd(64, 'x');
const previousSecret = process.env.COMPLIANCE_JOB_SECRET;
afterAll(() => {
  if (previousSecret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
  else process.env.COMPLIANCE_JOB_SECRET = previousSecret;
});

type HttpResult = { status: number; data: Record<string, unknown> };

async function startApi(
  db: Firestore,
  onDelete: (path: string) => Promise<void>,
  metadata: () => Promise<[{ generation: string; temporaryHold: boolean }]> =
    async () => [{ generation: '773', temporaryHold: false }],
) {
  process.env.COMPLIANCE_JOB_SECRET = secret;
  const app = express();
  app.use('/api/admin', createVerificationStoragePurgeRouter({
    getDb: () => db,
    getBucket: () => ({
      file: (path: string) => ({
        getMetadata: metadata,
        delete: async (options: { ifGenerationMatch: string | number }) => {
          expect(options).toEqual({ ifGenerationMatch: '773' });
          await onDelete(path);
        },
      }),
    }),
  }));
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('http_test_listener_not_bound');
  const url = 'http://127.0.0.1:' + address.port + '/api/admin/purge-verification-storage';

  return {
    request: async (valid = true): Promise<HttpResult> => {
      const body = '{}';
      const timestamp = String(Date.now());
      const signature = valid
        ? complianceSignature(timestamp + '.' + body, secret)
        : '0'.repeat(64);
      const response = await fetch(url, {
        method: 'POST', headers: {
          'content-type': 'application/json',
          'X-Klar-Compliance-Timestamp': timestamp,
          'X-Klar-Compliance-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* 401 is plain text */ }
      return { status: response.status, data };
    },
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

async function withEvent(
  testBody: (args: {
    db: Firestore; event: ReturnType<Firestore['doc']>;
    path: string;
  }) => Promise<void>,
) {
  const suffix = randomUUID().replace(/-/g, '');
  const app = initializeApp({ projectId: 'demo-klar' }, 'purge-http-' + suffix);
  const db = getFirestore(app, 'verification-purge-http-tests');
  const event = db.collection('verification_events').doc('http-' + suffix);
  const checkpoint = db.collection('system').doc('verification_photo_purge_scan_v1');
  const uid = 'emulator-' + suffix;
  const path = 'verification/' + uid + '/capture.jpg';
  try {
    await checkpoint.delete();
    await event.set({
      uid, storagePath: path,
      status: 'approved',
      decidedAt: Timestamp.fromMillis(Date.now() - 31 * 86_400_000),
      fotoLoeschenAb: new Date(Date.now() - 86_400_000),
      photoPurged: false,
    });
    await testBody({ db, event, path });
  } finally {
    try {
      await Promise.all([event.delete(), checkpoint.delete()]);
    } finally {
      await deleteApp(app);
    }
  }
}

describe.skipIf(!active)('signed verification storage purge HTTP route (Firestore Emulator)', () => {
  it('rejects bad HMAC before touching the DB; exactly one concurrent lease holder deletes', async () => {
    await withEvent(async ({ db, event, path }) => {
      let entered!: () => void;
      const pendingDelete = new Promise<void>(resolve => { entered = resolve; });
      let release!: () => void;
      const hold = new Promise<void>(resolve => { release = resolve; });
      const deleted: string[] = [];
      const api = await startApi(db, async target => {
        deleted.push(target);
        entered();
        await hold;
      });
      try {
        const invalid = await api.request(false);
        expect(invalid.status).toBe(401);
        expect(deleted).toHaveLength(0);

        const first = api.request();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            pendingDelete,
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(Error('purge_delete_never_started')), 10_000);
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
        const overlapping = await api.request();
        expect(overlapping).toMatchObject({
          status: 503, data: { code: 'verification_storage_purge_busy' },
        });
        release();
        const done = await first;
        expect(done).toMatchObject({
          status: 200,
          data: { ok: true, processed: 1, purgedCount: 1, failedCount: 0 },
        });
        expect(deleted).toEqual([path]);
        const record = (await event.get()).data();
        expect(record?.photoPurged).toBe(true);
        expect(record?.auditDigest).toMatch(/^[a-f0-9]{64}$/);
        const checkpoint = (await db.collection('system')
          .doc('verification_photo_purge_scan_v1').get()).data();
        expect(checkpoint?.leaseId).toBeNull();
        expect(checkpoint?.leaseUntil).toBeNull();
        expect(checkpoint?.cursor).toBeNull();
        const repeated = await api.request();
        expect(repeated).toMatchObject({ status: 200, data: { purgedCount: 0, skippedCount: 1 } });
        expect(deleted).toHaveLength(1);
      } finally {
        release();
        await api.close();
      }
    });
  }, 90_000);

  it('reports a generation conflict as 503 and safely retries without a false audit receipt', async () => {
    await withEvent(async ({ db, event, path }) => {
      let attempts = 0;
      const api = await startApi(db, async target => {
        expect(target).toBe(path);
        attempts++;
        if (attempts === 1) {
          throw Object.assign(Error('generation_replaced'), { code: 412 });
        }
      });
      try {
        const failed = await api.request();
        expect(failed).toMatchObject({ status: 503, data: {
          ok: false, processed: 1, failedCount: 1, purgedCount: 0,
        } });
        expect((await event.get()).data()?.photoPurged).toBe(false);
        const recovered = await api.request();
        expect(recovered).toMatchObject({ status: 200, data: {
          ok: true, processed: 1, failedCount: 0, purgedCount: 1,
        } });
        expect(attempts).toBe(2);
        expect((await event.get()).data()?.photoPurged).toBe(true);
      } finally {
        await api.close();
      }
    });
  }, 90_000);
  it('reconciles only a durable prior intent when the Storage delete succeeded but the audit transaction failed', async () => {
    await withEvent(async ({ db, event, path }) => {
      let present = true;
      let shouldFailAudit = false;
      let storageDeleteCalls = 0;
      const actualRunTransaction = db.runTransaction.bind(db);
      // Wrap just the server-side Firestore transaction entry point: once
      // physical deletion has succeeded, simulate a transient audit outage.
      const wrappedDb = new Proxy(db, {
        get(target, property) {
          if (property === 'runTransaction') {
            return async (...args: unknown[]) => {
              if (shouldFailAudit) {
                shouldFailAudit = false;
                throw Error('simulated_post_delete_audit_failure');
              }
              return (actualRunTransaction as unknown as (...params: unknown[]) => Promise<unknown>)(...args);
            };
          }
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as Firestore;
      const api = await startApi(wrappedDb, async target => {
        expect(target).toBe(path);
        storageDeleteCalls++;
        present = false;
        shouldFailAudit = true;
      }, async () => {
        if (!present) throw Object.assign(Error('Storage object missing'), { code: 404 });
        return [{ generation: '773', temporaryHold: false }];
      });
      try {
        const initial = await api.request();
        expect(initial).toMatchObject({ status: 503, data: {
          ok: false, processed: 1, failedCount: 1, purgedCount: 0,
        } });
        const pending = (await event.get()).data();
        expect(pending?.photoPurged).toBe(false);
        expect(pending?.photoPurgeIntent).toMatchObject({
          generation: '773', storagePath: path, status: 'approved',
        });
        expect(pending?.photoPurgeProof).toBeUndefined();

        const reconciled = await api.request();
        expect(reconciled).toMatchObject({ status: 200, data: {
          ok: true, processed: 1, purgedCount: 1, failedCount: 0,
        } });
        expect(storageDeleteCalls).toBe(1);
        const record = (await event.get()).data();
        expect(record?.photoPurged).toBe(true);
        expect(record?.photoPurgeProof).toMatchObject({
          method: 'absence_reconciled', generation: '773',
        });
        expect(record?.photoPurgeProof?.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);

        const replay = await api.request();
        expect(replay).toMatchObject({ status: 200, data: { purgedCount: 0, skippedCount: 1 } });
        expect(storageDeleteCalls).toBe(1);
      } finally {
        await api.close();
      }
    });
  }, 90_000);

  it('rejects a missing Storage object without a previously committed generation-bound intent', async () => {
    await withEvent(async ({ db, event }) => {
      let deleteCalls = 0;
      const api = await startApi(db, async () => {
        deleteCalls++;
      }, async () => {
        throw Object.assign(Error('Storage object missing'), { code: 404 });
      });
      try {
        const result = await api.request();
        expect(result).toMatchObject({ status: 503, data: {
          ok: false, processed: 1, purgedCount: 0, failedCount: 1,
        } });
        expect(deleteCalls).toBe(0);
        const doc = (await event.get()).data();
        expect(doc?.photoPurged).toBe(false);
        expect(doc?.photoPurgeIntent).toBeUndefined();
        expect(doc?.photoPurgeProof).toBeUndefined();
      } finally {
        await api.close();
      }
    });
  }, 90_000);

  it('rejects a replaced Storage generation after persisting the original intent', async () => {
    await withEvent(async ({ db, event }) => {
      let reads = 0;
      let deletes = 0;
      const api = await startApi(db, async () => { deletes++; }, async () => {
        reads++;
        return [{ generation: reads === 1 ? '773' : '774', temporaryHold: false }];
      });
      try {
        const first = await api.request();
        expect(first).toMatchObject({ status: 503, data: {
          purgedCount: 0, failedCount: 1,
        } });
        expect(deletes).toBe(0);
        expect((await event.get()).data()?.photoPurgeIntent?.generation).toBe('773');
        const retry = await api.request();
        expect(retry).toMatchObject({ status: 503, data: {
          purgedCount: 0, failedCount: 1,
        } });
        expect(deletes).toBe(0);
        expect((await event.get()).data()?.photoPurged).toBe(false);
      } finally {
        await api.close();
      }
    });
  }, 90_000);

  it('blocks physical deletion when moderation is changed after the first eligibility check', async () => {
    await withEvent(async ({ db, event }) => {
      let metadataReads = 0;
      let deletes = 0;
      const api = await startApi(db, async () => { deletes++; }, async () => {
        metadataReads++;
        if (metadataReads === 2) await event.update({ status: 'pending' });
        return [{ generation: '773', temporaryHold: false }];
      });
      try {
        const result = await api.request();
        expect(result).toMatchObject({ status: 503, data: {
          purgedCount: 0, failedCount: 1, ok: false,
        } });
        expect(metadataReads).toBe(2);
        expect(deletes).toBe(0);
        const record = (await event.get()).data();
        expect(record?.status).toBe('pending');
        expect(record?.photoPurged).toBe(false);
        expect(record?.photoPurgeProof).toBeUndefined();
      } finally { await api.close(); }
    });
  }, 90_000);

  it('blocks physical deletion if the Firestore lease expires before the final check', async () => {
    await withEvent(async ({ db, event }) => {
      let metadataReads = 0;
      let deletes = 0;
      const lease = db.collection('system').doc('verification_photo_purge_scan_v1');
      const api = await startApi(db, async () => { deletes++; }, async () => {
        metadataReads++;
        if (metadataReads === 2) {
          const state = (await lease.get()).data();
          expect(state?.leaseId).toEqual(expect.any(String));
          await lease.update({ leaseUntil: new Date(Date.now() - 1_000) });
        }
        return [{ generation: '773', temporaryHold: false }];
      });
      try {
        const result = await api.request();
        expect(result.status).toBe(503);
        expect(deletes).toBe(0);
        expect((await event.get()).data()?.photoPurged).toBe(false);
        expect((await event.get()).data()?.photoPurgeProof).toBeUndefined();
      } finally { await api.close(); }
    });
  }, 90_000);

});
