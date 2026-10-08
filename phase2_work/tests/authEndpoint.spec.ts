// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAccountRouter } from '../src/server/routes/account';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

async function endpoint(uid: string | null = 'user-a') {
  const revokeRefreshTokens = vi.fn().mockResolvedValue(undefined);
  const deletedTokens = [
    { ref: { path: 'users/user-a/fcmTokens/token-a' } },
    { ref: { path: 'users/user-a/fcmTokens/token-b' } },
  ];
  const tokenGet = vi.fn().mockResolvedValue({ docs: deletedTokens });
  const tokenCollection = vi.fn(() => ({ get: tokenGet }));
  const userDoc = vi.fn(() => ({ collection: tokenCollection }));
  const usersCollection = vi.fn(() => ({ doc: userDoc }));
  const batchDeletes: unknown[] = [];
  const batch = vi.fn(() => ({
    delete: vi.fn((ref: unknown) => batchDeletes.push(ref)),
    commit: vi.fn().mockResolvedValue(undefined),
  }));
  const db = { collection: usersCollection, batch };

  const app = express();
  app.use('/api', createAccountRouter({
    getFirestore: () => db as any,
    currentUserId: () => uid,
    getAuth: () => ({ revokeRefreshTokens } as any),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/logout`;

  return {
    revokeRefreshTokens,
    tokenGet,
    userDoc,
    tokenCollection,
    batch,
    batchDeletes,
    send: () => fetch(url, { method: 'POST' }),
  };
}

describe('POST /api/auth/logout', () => {
  it('rejects unauthenticated requests before revocation or token cleanup', async () => {
    const api = await endpoint(null);
    const response = await api.send();

    expect(response.status).toBe(401);
    expect(api.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(api.tokenGet).not.toHaveBeenCalled();
  });

  it('revokes refresh tokens, removes push tokens and clears the session cookie', async () => {
    const api = await endpoint();
    const response = await api.send();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, timestamp: expect.any(String) });
    expect(api.revokeRefreshTokens).toHaveBeenCalledWith('user-a');
    expect(api.userDoc).toHaveBeenCalledWith('user-a');
    expect(api.tokenCollection).toHaveBeenCalledWith('fcmTokens');
    expect(api.tokenGet).toHaveBeenCalledTimes(1);
    expect(api.batch).toHaveBeenCalledTimes(1);
    expect(api.batchDeletes).toHaveLength(2);
    expect(response.headers.get('set-cookie')).toMatch(/__session=;/);
  });
});
