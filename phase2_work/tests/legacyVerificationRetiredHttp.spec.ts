// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { verificationRouter } from '../src/server/verification-routes';

describe('retired manual biometric verification HTTP boundary', () => {
  let server: Server;
  let origin = '';

  beforeAll(async () => {
    const app = express();
    app.use('/api/verification', verificationRouter);
    server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw Error('retired_verification_local_listener_unavailable');
    }
    origin = 'http://127.0.0.1:' + address.port;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  });

  // Every method is refused, including anonymous client GET/POST and
  // accidental PUT/PATCH/DELETE; no authentication, Firestore or GCS access.
  for (const path of ['/verify', '/status', '/challenge', '/submit', '/decide']) {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      it('returns fixed HTTP 410 for ' + method + ' ' + path, async () => {
        const response = await fetch(origin + '/api/verification' + path, {
          method, redirect: 'error', signal: AbortSignal.timeout(5_000),
        });
        expect(response.status).toBe(410);
        expect(await response.json()).toEqual({
          code: 'verification_retired',
          error: 'Use the Didit identity verification flow.',
        });
      });
    }
  }
});
