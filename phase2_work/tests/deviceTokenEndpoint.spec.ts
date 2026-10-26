// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createDeviceTokenRouter } from '../src/server/routes/deviceTokens';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

async function endpoint(options: { uid?: string | null; fail?: boolean } = {}) {
  const set = vi.fn().mockImplementation(async () => {
    if (options.fail) throw new Error('private storage detail');
  });
  const tokenDoc = vi.fn(() => ({ set }));
  const tokenCollection = vi.fn(() => ({ doc: tokenDoc }));
  const userDoc = vi.fn(() => ({ collection: tokenCollection }));
  const usersCollection = vi.fn(() => ({ doc: userDoc }));
  const db = { collection: usersCollection, runTransaction: async (fn: any) => fn({ get: async () => ({ exists: false, data: () => undefined }), set: () => {}, update: () => {} }) };

  const app = express();
  app.use(express.json());
  app.use('/api', createDeviceTokenRouter({
    getFirestore: () => db as any,
    currentUserId: () => options.uid === undefined ? 'user-a' : options.uid,
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/device-token';

  return {
    set,
    userDoc,
    tokenCollection,
    tokenDoc,
    send: (body: unknown) => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

const validToken = 'fcm-token-abcdefghijklmnopqrstuvwxyz-123456';

describe('device-token HTTP boundary', () => {
  it('rejects unauthenticated requests before storage access', async () => {
    const api = await endpoint({ uid: null });
    const response = await api.send({ userId: 'user-a', token: validToken });
    expect(response.status).toBe(401);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('rejects attempts to register a token for another user', async () => {
    const api = await endpoint({ uid: 'user-a' });
    const response = await api.send({ userId: 'user-b', token: validToken });
    expect(response.status).toBe(403);
    expect(api.set).not.toHaveBeenCalled();
  });

  it.each([
    [{ userId: 'user-a', token: 'short' }],
    [{ userId: 'user-a', token: 'x'.repeat(4097) }],
    [{ userId: 'user-a', token: 'x'.repeat(20) + ' bad' }],
    [{ userId: 'user-a', token: validToken, extra: 'not-allowed' }],
  ])('rejects malformed payloads before storage access', async body => {
    const api = await endpoint();
    const response = await api.send(body);
    expect(response.status).toBe(400);
    expect(api.set).not.toHaveBeenCalled();
  });

  it('stores a valid token only under the authenticated user', async () => {
    const api = await endpoint();
    const response = await api.send({ userId: 'user-a', token: validToken });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(api.userDoc).toHaveBeenCalledWith('user-a');
    expect(api.tokenCollection).toHaveBeenCalledWith('fcmTokens');
    expect(api.tokenDoc).toHaveBeenCalledWith(validToken);
    expect(api.set).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'web', createdAt: expect.anything() }),
      { merge: true },
    );
  });

  it('does not acknowledge persistence failures or expose private errors', async () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await endpoint({ fail: true });
    const response = await api.send({ token: validToken });

    expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event: 'device_token_storage_failure' })]]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private storage detail');
  });
});
