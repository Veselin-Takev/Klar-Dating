// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { requestRouteForTelemetry } from '../src/server/requestTelemetry';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('request route telemetry privacy', () => {
  it.each([undefined, '', /secret/, ['/api/:id'], '/api/secret\nforged', 'not-a-route'])(
    'uses a bounded fallback for an unsupported route template: %j', path => {
      const request = { path: '/api/partner/click/private-token', originalUrl: '/api/partner/click/private-token?email=private', route: { path } };
      expect(requestRouteForTelemetry(request)).toBe('unmatched');
    },
  );

  it('preserves the registered template without substituting request params', () => {
    const request = {
      path: '/api/partner/click/private-token',
      originalUrl: '/api/partner/click/private-token?email=private',
      params: { token: 'private-token' },
      route: { path: '/api/partner/click/:token' },
    };
    expect(requestRouteForTelemetry(request)).toBe('/api/partner/click/:token');
  });

  it.each([200, 401, 404, 429, 500])('does not capture request secrets on HTTP %i', async status => {
    const recorded: string[] = [];
    const app = express();
    app.use((req, res, next) => {
      recorded.push(requestRouteForTelemetry(req));
      res.on('finish', () => { recorded.push(requestRouteForTelemetry(req)); });
      if (status !== 200) return res.status(status).send();
      next();
    });
    app.get('/api/partner/click/:token', (_req, res) => { res.status(200).send(); });
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const token = 'e'.repeat(64);
    const response = await fetch('http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/partner/click/' + token + '?recipient=private');
    expect(response.status).toBe(status);
    expect(recorded).toEqual(['unmatched', status === 200 ? '/api/partner/click/:token' : 'unmatched']);
    expect(JSON.stringify(recorded)).not.toContain(token);
    expect(JSON.stringify(recorded)).not.toContain('private');
  });
});
