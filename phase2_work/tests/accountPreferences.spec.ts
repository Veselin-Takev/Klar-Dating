// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAccountRouter } from '../src/server/routes/account';
const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function endpoint(fail = false) {
  const writes = vi.fn().mockImplementation(async () => { if (fail) throw new Error('internal secret'); });
  const doc = vi.fn(() => ({ set: writes }));
  const app = express(); app.use(express.json());
  app.use('/api', createAccountRouter({ getFirestore: () => ({ collection: () => ({ doc }), runTransaction: async (fn: any) => fn({ get: async () => ({ exists: false, data: () => undefined }), set: () => {}, update: () => {} }) }) as any,
    currentUserId: req => req.headers.authorization === 'Bearer test' ? 'own-user' : null,
    getAuth: () => ({ revokeRefreshTokens: vi.fn() } as any) }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/account/preferences`;
  return { writes, doc, send: (body: unknown, token = 'test') => fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) }) };
}
describe('profile language HTTP boundary', () => {
  it('persists only supported language on the authenticated account', async () => {
    const api = await endpoint();
    for (const language of ['de', 'en', 'es', 'fr']) expect((await api.send({ language })).status).toBe(200);
    expect(api.doc).toHaveBeenCalledWith('own-user');
    expect(api.writes).toHaveBeenLastCalledWith({ language: 'fr' }, { merge: true });
  });
  it('rejects unauthenticated calls, unsupported languages and privilege injection', async () => {
    const api = await endpoint();
    expect((await api.send({ language: 'en' }, 'invalid')).status).toBe(401);
    for (const body of [{ language: 'xx' }, { language: 'en', uid: 'other' }, { language: 'en', isVerified: true }]) expect((await api.send(body)).status).toBe(400);
    expect(api.writes).not.toHaveBeenCalled();
  });
  it('does not acknowledge failed persistence or leak internal details', async () => {
    const api = await endpoint(true); const response = await api.send({ language: 'en' });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
});
