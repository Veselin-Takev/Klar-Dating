import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { verificationRouter } from '../src/server/verification-routes';

let server: Server | undefined;
afterEach(() => new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()));

async function request(path: string, method = 'GET') {
  const app = express();
  app.use('/api/verification', verificationRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test address');
  return fetch(`http://127.0.0.1:${address.port}/api/verification/${path}`, { method });
}

describe('legacy identity verification retirement', () => {
  for (const [path, method] of [
    ['verify', 'POST'],
    ['status', 'GET'],
    ['challenge', 'POST'],
    ['submit', 'POST'],
    ['decide', 'POST'],
  ] as const) {
    it(`returns 410 for legacy ${method} ${path}`, async () => {
      const response = await request(path, method);
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({ code: 'verification_retired' });
    });
  }
});
