// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createDatePlansRouter } from '../src/server/routes/datePlans';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});
const future = () => new Date(Date.now() + 86_400_000).toISOString();
const routes = [
  ['GET', '/date-planner/connections', 'date_connections_failure'],
  ['POST', '/date-planner/ideas', 'date_ideas_failure'],
  ['GET', '/date-plans', 'date_plans_read_failure'],
  ['POST', '/date-plans', 'date_plan_create_failure'],
  ['DELETE', '/date-plans/plan-1', 'date_plan_delete_failure'],
  ['GET', '/date-availability', 'date_availability_read_failure'],
  ['POST', '/date-availability', 'date_availability_create_failure'],
  ['DELETE', '/date-availability/slot-1', 'date_availability_delete_failure'],
] as const;
function payload(path: string) {
  if (path === '/date-planner/ideas') return { connectionUid: 'other-user', city: 'Berlin', vibe: 'Casual' };
  if (path === '/date-plans') return {
    connectionUid: 'other-user', title: 'Synthetic date', description: 'Synthetic description',
    city: 'Berlin', vibe: 'Casual', startsAt: future(),
  };
  return { startsAt: future() };
}
async function endpoint(error: unknown, authenticated = true, writeFailure = false) {
  const reject = vi.fn(async () => { throw error; });
  const chain: any = {
    get: reject, create: reject, delete: reject,
    doc: vi.fn(() => chain), collection: vi.fn(() => chain),
    orderBy: vi.fn(() => chain), where: vi.fn(() => chain), limit: vi.fn(() => chain),
  };
  const db = { collection: vi.fn((name: string) => {
    if (writeFailure && name === 'public_profiles') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ isVerified: true }) }) }) };
    if (writeFailure && name === 'blocks') return { doc: () => ({ get: async () => ({ exists: false }) }) };
    return chain;
  }) };
  const getDb = vi.fn(() => db as any);
  const app = express(); app.use(express.json());
  app.use('/api', createDatePlansRouter({ currentUserId: () => authenticated ? 'own-user' : null, getFirestore: getDb }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { getDb, reject, send: (method: string, path: string) => fetch(base + path, {
    method, ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload(path)) } : {}),
  }) };
}
const errors = [
  new Error('synthetic@example.invalid Bearer PRIVATE-TOKEN'),
  { message: 'synthetic@example.invalid', headers: { authorization: 'Bearer PRIVATE-TOKEN' }, body: { location: 'PRIVATE-LOCATION' } },
  new Proxy({}, { get() { throw new Error('Must not inspect provider error'); } }),
];
describe('date planner failure log privacy over HTTP', () => {
  it.each(routes)('minimizes %s %s failures', async (method, path, event) => {
    for (const error of errors) {
      const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
      const api = await endpoint(error);
      const response = await api.send(method, path);
      expect(response.status).toBe(503);
      expect(api.reject).toHaveBeenCalledOnce();
      const text = await response.text();
      for (const marker of ['synthetic@example.invalid', 'PRIVATE-TOKEN', 'PRIVATE-LOCATION']) expect(text).not.toContain(marker);
      expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event })]]);
      sink.mockRestore();
    }
  });
  it('does not acknowledge a failed plan write after successful connection checks', async () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await endpoint(errors[0], true, true);
    expect((await api.send('POST', '/date-plans')).status).toBe(503);
    expect(api.reject).toHaveBeenCalledOnce();
    expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event: 'date_plan_create_failure' })]]);
  });
  it.each(routes)('rejects unauthenticated %s %s before database access', async (method, path) => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await endpoint(errors[0], false);
    expect((await api.send(method, path)).status).toBe(401);
    expect(api.getDb).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });
});
