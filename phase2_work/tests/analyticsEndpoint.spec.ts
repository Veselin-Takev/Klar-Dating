// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAnalyticsRouter } from '../src/server/routes/analytics';
import { EINWILLIGUNG_VERSION } from '../src/server/pure';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function endpoint(options: { consent?: boolean; fail?: boolean; enabled?: boolean } = {}) {
  const writes = vi.fn().mockImplementation(async () => { if (options.fail) throw new Error('private internal detail'); });
  const db = { collection: () => ({ add: writes, doc: () => ({ get: async () => ({ data: () => ({ einwilligung: { version: EINWILLIGUNG_VERSION, zwecke: { produktanalyse: options.consent === true } } }) }) }) }) };
  const app = express();
  app.use('/api/analytics/track', createAnalyticsRouter({ enabled: () => options.enabled !== false, getDb: () => db as any, requireAuth: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test-user') { res.status(401).end(); return; }
    (req as any).user = { uid: 'server-user' }; next();
  } }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics/track`;
  return { writes, send: (body: unknown, token = 'test-user') => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: typeof body === 'string' ? body : JSON.stringify(body) }) };
}
const payload = { step: 'onboarding_started', sessionId: 'test-session-123' };
describe('analytics HTTP boundary', () => {
  it('requires authentication and a persisted, separate product consent', async () => {
    const { send, writes } = await endpoint();
    expect((await send(payload, 'invalid')).status).toBe(401);
    expect((await send(payload)).status).toBe(403); expect(writes).not.toHaveBeenCalled();
  });
  it.each([{ ...payload, userId: 'forged' }, { ...payload, metadata: { phone: '+491234' } }, { ...payload, step: 'other' }, '{broken', 'x'.repeat(10241)])('rejects invalid or oversized input before a write', async body => {
    const { send, writes } = await endpoint({ consent: true });
    expect((await send(body)).status).toBe(400); expect(writes).not.toHaveBeenCalled();
  });
  it('enforces 30 requests per minute even if the client rotates the session ID', async () => {
    const { send, writes } = await endpoint({ consent: true });
    for (let i = 0; i < 30; i++) expect((await send({ ...payload, sessionId: `rotating-${i}` })).status).toBe(201);
    expect((await send(payload)).status).toBe(429); expect(writes).toHaveBeenCalledTimes(30);
    expect(writes.mock.calls[0]?.[0]).toMatchObject({ userId: 'server-user' });
    expect(writes.mock.calls[0]?.[0].sessionId).not.toBe(payload.sessionId);
  });
  it('does not acknowledge unavailable storage or a disabled feature', async () => {
    const failed = await endpoint({ consent: true, fail: true });
    const res = await failed.send(payload); expect(res.status).toBe(503); expect(await res.text()).not.toContain('private');
    const disabled = await endpoint({ consent: true, enabled: false });
    expect((await disabled.send(payload)).status).toBe(503); expect(disabled.writes).not.toHaveBeenCalled();
  });
});
