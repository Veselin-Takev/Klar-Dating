// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

vi.mock('../src/server/datenschutz', () => ({
  handleAlter: vi.fn(), handleEinwilligung: vi.fn(), handleEinwilligungZweck: vi.fn(),
  handleEinwilligungLesen: vi.fn(), handleEinwilligungWiderruf: vi.fn(), handleExport: vi.fn(),
}));
vi.mock('../src/server/trustAndSafety', () => ({ handleDeleteAccount: vi.fn() }));
import { createAccountRouter } from '../src/server/routes/account';
import { handleDeleteAccount } from '../src/server/trustAndSafety';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const privateError = Object.assign(new Error('Bearer synthetic-secret user@example.invalid session-private'), {
  headers: { authorization: 'Bearer synthetic-secret' }, token: 'push-token-private',
  request: { body: { consent: 'private-consent' } },
});

async function endpoint(failure: 'rate' | 'revoke' | 'tokens' | 'status', authenticated = true) {
  const revoke = vi.fn(async () => { if (failure === 'revoke') throw privateError; });
  const read = vi.fn(async () => { throw privateError; });
  const transaction = vi.fn(async () => { throw privateError; });
  const app = express();
  app.use(express.json());
  app.use('/api', createAccountRouter({
    currentUserId: () => authenticated ? 'synthetic-user' : null,
    getAuth: () => ({ revokeRefreshTokens: revoke } as any),
    getFirestore: () => ({
      collection: () => ({ doc: () => ({ get: read, collection: () => ({ get: read }) }) }),
      runTransaction: transaction,
    } as any),
  }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { revoke, read, transaction, send: (path: string, method: string) => fetch(base + path, { method }) };
}

describe('account failure log privacy at HTTP boundaries', () => {
  it.each([
    ['rate', '/account/delete', 'POST', 'account_deletion_limit_failure'],
    ['revoke', '/auth/logout', 'POST', 'account_logout_failure'],
    ['tokens', '/auth/logout', 'POST', 'account_logout_failure'],
    ['status', '/account/status', 'GET', 'account_status_read_failure'],
  ] as const)('fails closed and emits only an allowlisted event for %s', async (failure, path, method, event) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await endpoint(failure);
    const response = await api.send(path, method);
    expect(response.status).toBe(503);
    const body = await response.text();
    for (const marker of ['synthetic-secret', 'user@example.invalid', 'session-private', 'push-token-private', 'private-consent']) {
      expect(body).not.toContain(marker);
    }
    expect(log.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event })]]);
    expect(handleDeleteAccount).not.toHaveBeenCalled();
    if (failure === 'rate') expect(api.transaction).toHaveBeenCalledOnce();
    if (failure === 'revoke') expect(api.read).not.toHaveBeenCalled();
    if (failure === 'tokens') expect(api.revoke).toHaveBeenCalledWith('synthetic-user');
    if (failure === 'status') expect(api.read).toHaveBeenCalledOnce();
  });

  it.each([['/auth/logout', 'POST'], ['/account/status', 'GET']] as const)(
    'rejects unauthenticated %s before provider access', async (path, method) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const api = await endpoint('revoke', false);
      expect((await api.send(path, method)).status).toBe(401);
      expect(api.revoke).not.toHaveBeenCalled();
      expect(api.read).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    },
  );
});
