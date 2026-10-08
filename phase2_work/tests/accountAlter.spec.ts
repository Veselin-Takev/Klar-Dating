// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

const processAgeVerification = vi.hoisted(() => vi.fn());
vi.mock('../src/server/platform/ageGateEngine', () => ({ processAgeVerification }));

import { createAccountRouter } from '../src/server/routes/account';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  vi.clearAllMocks();
});

async function endpoint() {
  const app = express();
  app.use(express.json());
  app.use('/api', createAccountRouter({
    getFirestore: () => ({
      collection: () => ({ doc: () => ({}) }),
      runTransaction: async (fn: any) => fn({ get: async () => ({ exists: false, data: () => undefined }), set: () => {}, update: () => {} }),
    } as never),
    currentUserId: () => 'user-age-contract',
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/account/alter`;
  return { send: (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}

describe('POST /api/account/alter contract', () => {
  it('accepts canonical ISO dates and returns 200 for an adult', async () => {
    processAgeVerification.mockResolvedValue({ ok: true, status: 'verified_adult', age: 26, evidenceDigest: 'digest' });
    const api = await endpoint();
    const response = await api.send({ geburtsdatum: '2000-01-10' });
    expect(response.status).toBe(200);
    expect(processAgeVerification).toHaveBeenCalledWith(expect.anything(), undefined, '2000-01-10');
  });

  it('returns 422 with a domain code for underage submissions', async () => {
    processAgeVerification.mockResolvedValue({ ok: false, status: 'locked_underage', age: 17, code: 'underage_locked', error: 'underage' });
    const api = await endpoint();
    const response = await api.send({ geburtsdatum: '2009-01-10' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNDERAGE_RESTRICTION' });
  });

  it('returns 400 for non-ISO payloads before domain processing', async () => {
    const api = await endpoint();
    const response = await api.send({ geburtsdatum: '10.01.2000' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_DATE_FORMAT' });
    expect(processAgeVerification).not.toHaveBeenCalled();
  });
});
