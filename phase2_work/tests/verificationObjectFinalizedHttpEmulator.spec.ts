// @vitest-environment node
// Local-only HTTP integration tests for the signed Storage Object Finalize boundary.
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  complianceSignature,
} from '../src/server/routes/complianceStorage';
import {
  createVerificationObjectFinalizedRouter,
} from '../src/server/routes/verificationObjectFinalized';
import {
  TRUSTED_VERIFICATION_WRITER_MARKER,
} from '../src/server/platform/verificationObjectRegistration';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const localEmulator = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(emulatorHost);
const emulatorActive = Boolean(localEmulator);
const projects = [
  process.env.GCLOUD_PROJECT,
  process.env.GOOGLE_CLOUD_PROJECT,
  process.env.FIREBASE_PROJECT_ID,
].filter(Boolean);

if (emulatorHost && (!localEmulator
  || Number(localEmulator[2]) < 1 || Number(localEmulator[2]) > 65535
  || projects.some(project => project !== 'demo-klar')
  || process.env.NODE_ENV === 'production'
  || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true')) {
  throw new Error('verification_object_finalize_emulator_target_unsafe');
}

const secret = 'verification-finalize-emulator-secret-'.padEnd(64, 'x');
const previousSecret = process.env.COMPLIANCE_JOB_SECRET;
afterAll(() => {
  if (previousSecret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
  else process.env.COMPLIANCE_JOB_SECRET = previousSecret;
});

type HttpResult = { status: number; data: Record<string, unknown> };

async function withEmulatorDb(body: (db: Firestore) => Promise<void>): Promise<void> {
  const suffix = randomUUID().replace(/-/g, '');
  const app = initializeApp({ projectId: 'demo-klar' }, 'verification-finalize-http-' + suffix);
  const db = getFirestore(app, 'verification-finalize-http-' + suffix);
  try {
    await body(db);
  } finally {
    try {
      await db.recursiveDelete(db.collection('verificationDeletionFences'));
      await db.recursiveDelete(db.collection('verificationObjectFinalizeHmacReplays'));
    } finally {
      await deleteApp(app);
    }
  }
}

async function startApi(db: Firestore) {
  process.env.COMPLIANCE_JOB_SECRET = secret;
  const app = express();
  app.use('/internal/verification', createVerificationObjectFinalizedRouter({
    getDb: () => db,
    getBucketName: () => 'synthetic-klar-verification-test',
  }));
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('verification_finalize_http_listener_missing');
  const url = 'http://127.0.0.1:' + address.port + '/internal/verification/object-finalized';

  return {
    request: async (
      body: string,
      options: {
        timestamp?: string;
        signature?: string;
        omitTimestamp?: boolean;
        omitSignature?: boolean;
        validSignature?: boolean;
      } = {},
    ): Promise<HttpResult> => {
      const timestamp = options.timestamp ?? String(Date.now());
      const signature = options.signature ?? (options.validSignature === false
        ? '0'.repeat(64)
        : complianceSignature(timestamp + '.' + body, secret));
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (!options.omitTimestamp) headers['X-Klar-Compliance-Timestamp'] = timestamp;
      if (!options.omitSignature) headers['X-Klar-Compliance-Signature'] = signature;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* auth failures have no JSON body */ }
      return { status: response.status, data };
    },
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

function finalizedObject(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    bucket: 'synthetic-klar-verification-test',
    name: 'verification/' + uid + '/capture.jpg',
    generation: '773',
    metageneration: '1',
    metadata: {
      klarWriter: TRUSTED_VERIFICATION_WRITER_MARKER,
      uid,
      challengeId: 'challenge-' + uid,
      createdBy: 'verification-backend',
    },
    ...overrides,
  };
}

async function fenceSnapshot(db: Firestore) {
  const snapshot = await db.collection('verificationDeletionFences').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data(),
    updateTime: doc.updateTime?.toMillis() ?? null,
  }));
}

describe.skipIf(!emulatorActive)('verification Object Finalize HTTP boundary (Firestore Emulator)', () => {
  it.each([
    ['invalid HMAC', { validSignature: false }],
    ['missing HMAC timestamp', { omitTimestamp: true }],
    ['missing HMAC signature', { omitSignature: true }],
  ])('rejects %s before creating or mutating a deletion fence', async (_label, authOptions) => {
    await withEmulatorDb(async db => {
      const api = await startApi(db);
      try {
        const uid = 'invalid-auth-' + randomUUID().replace(/-/g, '');
        const body = JSON.stringify(finalizedObject(uid));
        const before = await fenceSnapshot(db);
        const response = await api.request(body, authOptions);
        expect(response.status).toBe(401);
        expect(await fenceSnapshot(db)).toEqual(before);
      } finally {
        await api.close();
      }
    });
  }, 30_000);

  it('rejects a replayed HMAC and proves the replay did not mutate the existing fence', async () => {
    await withEmulatorDb(async db => {
      const api = await startApi(db);
      try {
        const uid = 'replayed-' + randomUUID().replace(/-/g, '');
        const body = JSON.stringify(finalizedObject(uid));
        const timestamp = String(Date.now());
        const signature = complianceSignature(timestamp + '.' + body, secret);
        const first = await api.request(body, { timestamp, signature });
        expect(first).toMatchObject({ status: 200, data: { ok: true, registered: true } });
        const beforeReplay = await fenceSnapshot(db);
        expect(beforeReplay).toHaveLength(1);

        const replay = await api.request(body, { timestamp, signature });
        expect(replay.status).toBe(401);
        expect(await fenceSnapshot(db)).toEqual(beforeReplay);
      } finally {
        await api.close();
      }
    });
  }, 30_000);

  it('persists one deterministic idempotent fence for valid HMAC and trusted metadata', async () => {
    await withEmulatorDb(async db => {
      const api = await startApi(db);
      try {
        const uid = 'valid-' + randomUUID().replace(/-/g, '');
        const body = JSON.stringify(finalizedObject(uid));
        const first = await api.request(body);
        expect(first).toMatchObject({ status: 200, data: { ok: true, registered: true } });
        const firstSnapshot = await fenceSnapshot(db);
        expect(firstSnapshot).toHaveLength(1);
        expect(firstSnapshot[0].data).toMatchObject({
          uid,
          challengeId: 'challenge-' + uid,
          bucket: 'synthetic-klar-verification-test',
          storagePath: 'verification/' + uid + '/capture.jpg',
          observedGeneration: '773',
          observedMetageneration: '1',
          state: 'eligible',
        });

        // A new timestamp produces a fresh authenticated request; registration
        // remains idempotent for the same immutable Storage object generation.
        const second = await api.request(body);
        expect(second).toMatchObject({ status: 200, data: { ok: true, registered: true } });
        expect(await fenceSnapshot(db)).toEqual(firstSnapshot);
      } finally {
        await api.close();
      }
    });
  }, 30_000);

  it.each([
    ['missing writer marker', { klarWriter: undefined }],
    ['wrong UID', { uid: 'different-user' }],
    ['blank challenge ID', { challengeId: '   ' }],
    ['missing creator', { createdBy: undefined }],
  ])('rejects validly signed object with %s without persisting a fence', async (_label, metadataPatch) => {
    await withEmulatorDb(async db => {
      const api = await startApi(db);
      try {
        const uid = 'malformed-' + randomUUID().replace(/-/g, '');
        const valid = finalizedObject(uid);
        const metadata = { ...valid.metadata, ...metadataPatch };
        const body = JSON.stringify({ ...valid, metadata });
        const before = await fenceSnapshot(db);
        const response = await api.request(body);
        expect(response.status).toBe(422);
        expect(await fenceSnapshot(db)).toEqual(before);
      } finally {
        await api.close();
      }
    });
  }, 30_000);
});
