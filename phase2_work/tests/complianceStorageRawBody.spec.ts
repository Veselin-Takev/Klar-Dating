// @vitest-environment node
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { createVerificationStoragePurgeRouter } from '../src/server/routes/complianceStorage';

const secret = 'synthetic-compliance-job-secret-of-sufficient-length';
const initialSecret = process.env.COMPLIANCE_JOB_SECRET;
const servers: Server[] = [];

beforeEach(() => { process.env.COMPLIANCE_JOB_SECRET = secret; });
afterEach(async () => {
  if (initialSecret === undefined) delete process.env.COMPLIANCE_JOB_SECRET;
  else process.env.COMPLIANCE_JOB_SECRET = initialSecret;
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  })));
});

async function origin() {
  // The order mirrors the canonical Express entry point. A separate source
  // gate checks that server.ts mounts its own raw parser before express.json.
  const app = express();
  app.use('/api/admin/purge-verification-storage',
    express.raw({ inflate: false, type: 'application/json', limit: '2kb' }));
  app.use(express.json({ inflate: false, limit: '900kb', strict: true }));
  const emptyDb = {
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }),
  } as unknown as Firestore;
  app.use('/api/admin', createVerificationStoragePurgeRouter({
    getDb: () => emptyDb,
    getBucket: () => ({ file: () => ({ delete: async () => undefined }) }),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}

function proof(timestamp: string, bytes: Uint8Array) {
  return createHmac('sha256', secret).update(timestamp + '.').update(bytes).digest('hex');
}

async function send(base: string, body: Uint8Array | string, options: {
  timestamp?: string;
  signature?: string;
  contentType?: string;
} = {}) {
  const timestamp = options.timestamp ?? String(Date.now());
  const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
  return fetch(base + '/api/admin/purge-verification-storage', {
    method: 'POST',
    headers: {
      'content-type': options.contentType ?? 'application/json',
      'X-Klar-Compliance-Timestamp': timestamp,
      'X-Klar-Compliance-Signature': options.signature ?? proof(timestamp, bytes),
    },
    body: Uint8Array.from(bytes),
  });
}

describe('decision-bound purge HTTP raw body / HMAC boundary (A-14)', () => {
  it('accepts a correctly signed canonical scheduler body', async () => {
    const base = await origin();
    const response = await send(base, '{}');
    expect(response.status).toBe(200);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: true, processed: 0, purgedCount: 0 });
  });

  it('rejects altered request bytes even with a valid signature for a different payload', async () => {
    const base = await origin();
    const timestamp = String(Date.now());
    const signature = proof(timestamp, Buffer.from('{}'));
    const response = await send(base, '{ }', { timestamp, signature });
    expect(response.status).toBe(401);
  });

  it('preserves raw binary octets including malformed UTF-8 without lossy re-encoding', async () => {
    const base = await origin();
    const bytes = Uint8Array.from([0xff, 0xfe, 0x7b, 0x7d]);
    const response = await send(base, bytes, { contentType: 'application/json; charset=iso-8859-1' });
    expect(response.status).toBe(200);
    const timestamp = String(Date.now());
    const canonicalized = Buffer.from(Buffer.from(bytes).toString('utf8'), 'utf8');
    const corruptedProof = proof(timestamp, canonicalized);
    const bad = await send(base, bytes, { timestamp, signature: corruptedProof });
    expect(bad.status).toBe(401);
  });

  it('rejects unsupported content types rather than HMAC-checking a fabricated body', async () => {
    const base = await origin();
    const response = await send(base, '{}', { contentType: 'text/plain' });
    expect(response.status).toBe(415);
  });

  it('rejects a stale HMAC proof, even when its bytes and signature match', async () => {
    const base = await origin();
    const timestamp = String(Date.now() - 301_000);
    const response = await send(base, '{}', { timestamp });
    expect(response.status).toBe(401);
  });

  it('rejects requests above 2 KiB without reaching the HMAC handler', async () => {
    const base = await origin();
    const response = await send(base, 'x'.repeat(2049));
    expect(response.status).toBe(413);
  });
});
