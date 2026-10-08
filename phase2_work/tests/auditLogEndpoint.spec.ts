// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAuditLogRouter, serializeTimestamp } from '../src/server/routes/auditLogs';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

async function endpoint(options: { fail?: boolean } = {}) {
  const get = vi.fn(async () => {
    if (options.fail) throw new Error('private firestore detail');
    return {
      docs: [{
        id: 'log-1',
        data: () => ({
          userId: 'user-a',
          type: 'ki_coach_interaction',
          encryptedInput: 'cipher-input',
          encryptedOutput: 'cipher-output',
          timestamp: { toDate: () => new Date('2026-09-30T10:00:00Z') },
        }),
      }],
    };
  });
  const limit = vi.fn(() => ({ get }));
  const orderBy = vi.fn(() => ({ limit }));
  const db = { collection: vi.fn(() => ({ orderBy })) } as any;

  const app = express();
  app.use('/api/admin', createAuditLogRouter({ getFirestore: () => db }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return {
    url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/admin/audit-logs',
    db,
  };
}

describe('audit log metadata boundary', () => {
  it('returns operational metadata without encrypted user content', async () => {
    const api = await endpoint();
    const response = await fetch(api.url);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.logs).toEqual([{
      id: 'log-1',
      userId: 'user-a',
      type: 'ki_coach_interaction',
      timestamp: '2026-09-30T10:00:00.000Z',
      hasEncryptedPayload: true,
    }]);
    expect(JSON.stringify(body)).not.toContain('cipher-input');
    expect(JSON.stringify(body)).not.toContain('cipher-output');
  });

  it('isolates malformed Firestore timestamps', () => {
    expect(serializeTimestamp({ toDate: () => { throw new Error('bad timestamp'); } })).toBeNull();
    expect(serializeTimestamp({ toDate: () => 'not-a-date' })).toBeNull();
  });

  it('limits the query to the 50 most recent records', async () => {
    const api = await endpoint();
    await fetch(api.url);
    const collection = api.db.collection.mock.results[0].value;
    expect(collection.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
    expect(collection.orderBy.mock.results[0].value.limit).toHaveBeenCalledWith(50);
  });

  it('fails closed without exposing datastore details', async () => {
    const api = await endpoint({ fail: true });
    const response = await fetch(api.url);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('private firestore detail');
  });
});
