// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createFeedbackRouter } from '../src/server/routes/feedback';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

async function endpoint(options: { fail?: boolean } = {}) {
  const add = vi.fn(async () => {
    if (options.fail) throw new Error('private storage detail');
  });
  const db = {
    collection: vi.fn(() => ({ add })),
  } as any;

  const app = express();
  app.use('/api', createFeedbackRouter({
    getFirestore: () => db,
    now: () => new Date('2026-09-30T10:00:00Z'),
  }));
  app.post('/api/contact', (_req, res) => res.status(409).json({ code: 'contact_unverified' }));

  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const url = origin + '/api/feedback';

  return {
    add,
    send: (body: unknown) => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    sendOther: () => fetch(origin + '/api/contact', { method: 'POST' }),
  };
}

describe('public feedback HTTP boundary', () => {
  it('stores valid feedback without user identity', async () => {
    const api = await endpoint();
    const response = await api.send({ rating: 5, text: '  Sehr gut  ' });

    expect(response.status).toBe(200);
    expect(api.add).toHaveBeenCalledWith({
      rating: 5,
      text: 'Sehr gut',
      uid: 'anonymous',
      createdAt: '2026-09-30T10:00:00.000Z',
      timestamp: 1790762400000,
    });
  });

  it.each([
    [{ rating: 0 }],
    [{ rating: 6 }],
    [{ rating: 1.5 }],
    [{ rating: '5' }],
    [{ rating: true }],
    [{ rating: 5, uid: 'client-controlled' }],
    [{ rating: 5, text: 'x'.repeat(2001) }],
  ])('rejects malformed or identity-bearing payloads', async body => {
    const api = await endpoint();
    const response = await api.send(body);
    expect(response.status).toBe(400);
    expect(api.add).not.toHaveBeenCalled();
  });

  it('returns 503 without exposing storage details when persistence fails', async () => {
    const api = await endpoint({ fail: true });
    const response = await api.send({ rating: 4, text: 'ok' });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private storage detail');
  });

  it('limits only POST /api/feedback and never throttles a sibling API route', async () => {
    const api = await endpoint();
    for (let i = 0; i < 10; i += 1) {
      expect((await api.send({ rating: 5, text: 'bounded request ' + i })).status).toBe(200);
    }
    expect((await api.send({ rating: 5, text: 'over quota' })).status).toBe(429);
    for (let i = 0; i < 12; i += 1) {
      expect((await api.sendOther()).status, 'feedback quota must not leak to /api/contact').toBe(409);
    }
  });
});
