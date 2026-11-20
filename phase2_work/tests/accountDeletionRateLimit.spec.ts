// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

vi.mock('../src/server/datenschutz', () => ({
  handleAlter: vi.fn(), handleEinwilligung: vi.fn(), handleEinwilligungZweck: vi.fn(),
  handleEinwilligungLesen: vi.fn(), handleEinwilligungWiderruf: vi.fn(), handleExport: vi.fn(),
}));
vi.mock('../src/server/trustAndSafety', () => ({ handleDeleteAccount: vi.fn() }));
import { createAccountRouter } from '../src/server/routes/account';
import { handleDeleteAccount } from '../src/server/trustAndSafety';

type LimitRecord = { count: number; windowStartedAt: number; expiresAt: Date };
const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server =>
    new Promise<void>(resolve => server.close(() => resolve())),
  ));
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(handleDeleteAccount).mockImplementation(async (_req, res) => {
    res.status(202).json({ ok: true, status: 'pending', requestId: 'test-request' });
  });
});

async function endpoint(failTransaction = false) {
  const records = new Map<string, LimitRecord>();
  const set = vi.fn((ref: { id: string }, value: LimitRecord) => { records.set(ref.id, value); });
  const update = vi.fn((ref: { id: string }, patch: Partial<LimitRecord>) => {
    const existing = records.get(ref.id);
    if (!existing) throw new Error('transaction update target missing');
    records.set(ref.id, { ...existing, ...patch });
  });
  const get = vi.fn(async (ref: { id: string }) => {
    const value = records.get(ref.id);
    return { exists: value !== undefined, data: () => value };
  });
  const runTransaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
    if (failTransaction) throw new Error('synthetic Firestore transaction failure');
    return callback({ get, set, update });
  });
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ id })) })),
    runTransaction,
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createAccountRouter({
    getFirestore: () => db as never,
    currentUserId: () => 'account-deletion-rate-limit-user',
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/account/delete`;
  return { records, set, update, send: () => fetch(url, { method: 'POST' }) };
}

describe('account deletion distributed rate limiter', () => {
  it('accepts the first Art. 17 request and creates a missing rate-limit record', async () => {
    const api = await endpoint();
    const response = await api.send();
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true, status: 'pending', requestId: 'test-request',
    });
    expect(api.set).toHaveBeenCalledOnce();
    expect(api.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
      expect.objectContaining({ count: 1, windowStartedAt: expect.any(Number), expiresAt: expect.any(Date) }),
    );
    expect(api.update).not.toHaveBeenCalled();
    expect(handleDeleteAccount).toHaveBeenCalledOnce();
    expect([...api.records.values()].map(record => record.count)).toEqual([1]);
  });

  it('allows three requests in the 24-hour window and rejects the fourth without reaching erasure', async () => {
    const api = await endpoint();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await api.send()).status).toBe(202);
    }
    const rejected = await api.send();
    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toMatchObject({
      error: 'Zu viele Löschanträge. Bitte später erneut versuchen.',
    });
    expect([...api.records.values()].map(record => record.count)).toEqual([3]);
    expect(api.set).toHaveBeenCalledOnce();
    expect(api.update).toHaveBeenCalledTimes(2);
    expect(handleDeleteAccount).toHaveBeenCalledTimes(3);
  });

  it('fails closed with 503 and does not invoke erasure when Firestore fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await endpoint(true);
    const response = await api.send();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Löschantrag derzeit nicht verfügbar.',
    });
    expect(handleDeleteAccount).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(JSON.stringify({
      level: 'ERROR', event: 'account_deletion_limit_failure',
    }));
  });
});
