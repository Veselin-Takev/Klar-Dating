// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { distributedRateLimit } from '../src/server/distributedRateLimiter';

type Stored = { count: number; windowStartedAt: number; expiresAt: Date };

function fakeDb(store: Map<string, Stored>) {
  return {
    collection: () => ({
      doc: (path: string) => ({
        path,
      }),
    }),
    runTransaction: async (fn: (tx: { get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => Stored | undefined }>; set: (ref: { path: string }, data: Stored) => void; update: (ref: { path: string }, data: Partial<Stored>) => void }) => Promise<unknown>) => {
      const tx = {
        get: async (ref: { path: string }) => {
          const data = store.get(ref.path);
          return { exists: Boolean(data), data: () => data };
        },
        set: (ref: { path: string }, data: Stored) => { store.set(ref.path, data); },
        update: (ref: { path: string }, data: Partial<Stored>) => {
          const current = store.get(ref.path);
          if (!current) throw new Error('missing counter');
          store.set(ref.path, { ...current, ...data });
        },
      };
      return fn(tx);
    },
  } as any;
}

async function request(middleware: ReturnType<typeof distributedRateLimit>) {
  const app = express();
  app.use(middleware);
  app.get('/resource', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const response = await fetch('http://127.0.0.1:' + port + '/resource');
  await new Promise<void>(resolve => server.close(() => resolve()));
  return response;
}

describe('distributedRateLimit', () => {
  it('shares the counter across separate middleware instances', async () => {
    const store = new Map<string, Stored>();
    const options = {
      collection: 'test_rate_limit',
      windowMs: 60_000,
      limit: 2,
      keyGenerator: () => 'uid:test-user',
      message: { error: 'limited' },
      getDb: () => fakeDb(store),
    };
    const first = await request(distributedRateLimit(options));
    const second = await request(distributedRateLimit(options));
    const third = await request(distributedRateLimit(options));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toMatch(/^[1-9]\d*$/);
  });

  it('uses independent counters for different identities', async () => {
    const store = new Map<string, Stored>();
    let identity = 'uid:a';
    const middleware = distributedRateLimit({
      collection: 'test_rate_limit_identity',
      windowMs: 60_000,
      limit: 1,
      keyGenerator: () => identity,
      message: { error: 'limited' },
      getDb: () => fakeDb(store),
    });
    expect((await request(middleware)).status).toBe(200);
    expect((await request(middleware)).status).toBe(429);
    identity = 'uid:b';
    expect((await request(middleware)).status).toBe(200);
  });
});
