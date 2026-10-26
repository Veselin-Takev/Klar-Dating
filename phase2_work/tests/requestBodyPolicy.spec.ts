// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { rejectEncodedRequestBodies } from '../src/server/middleware/requestBodyPolicy';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve()); server.closeAllConnections();
  })));
});
async function serve(app: express.Express) {
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}
describe('request entity encoding boundary', () => {
  it.each(['gzip', 'br', 'deflate', 'identity, gzip', 'unknown'])('rejects %s before parsing or dispatch', async encoding => {
    const app = express(); let parserReached = false;
    app.use(rejectEncodedRequestBodies);
    app.use((_req, _res, next) => { parserReached = true; next(); });
    app.use(express.json({ inflate: false, limit: '1kb' }));
    app.post('/test', (_req, res) => res.json({ dispatched: true }));
    const response = await fetch(await serve(app) + '/test', {
      method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': encoding },
      body: new Uint8Array(gzipSync('{"ok":true}')) });
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ code: 'unsupported_content_encoding', error: 'Encoded request bodies are not supported.' });
    expect(parserReached).toBe(false);
  });
  it.each([undefined, 'identity', 'IDENTITY'])('preserves plain JSON with encoding %s', async encoding => {
    const app = express(); app.use(rejectEncodedRequestBodies);
    app.use(express.json({ inflate: false, limit: '1kb' }));
    app.post('/test', (req, res) => res.json(req.body));
    const response = await fetch(await serve(app) + '/test', { method: 'POST',
      headers: { 'content-type': 'application/json', ...(encoding ? { 'content-encoding': encoding } : {}) }, body: '{"ok":true}' });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
  });
  it('preserves exact raw webhook bytes and ignores Accept-Encoding', async () => {
    const app = express(); app.use(rejectEncodedRequestBodies);
    app.use(express.raw({ type: 'application/json', inflate: false, limit: '1kb' }));
    app.post('/webhook', (req, res) => res.json({ hex: req.body.toString('hex') }));
    const body = '{ "event": "synthetic", "value": 1 }\n';
    const response = await fetch(await serve(app) + '/webhook', { method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-encoding': 'gzip, br' }, body });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ hex: Buffer.from(body).toString('hex') });
  });
  it.each([['{', 400], [JSON.stringify({ value: 'x'.repeat(1200) }), 413]] as const)('keeps JSON validation and byte limits', async (body, status) => {
    const app = express(); let dispatched = false; app.use(rejectEncodedRequestBodies);
    app.use(express.json({ inflate: false, limit: '1kb' }));
    app.post('/test', (_req, res) => { dispatched = true; res.json({ ok: true }); });
    const response = await fetch(await serve(app) + '/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect(response.status).toBe(status); expect(dispatched).toBe(false);
  });
  it('mounts the boundary before parsers and disables inflate at all active parser sites', () => {
    const server = readFileSync('server.ts', 'utf8'), mount = server.indexOf('app.use(rejectEncodedRequestBodies)');
    expect(mount).toBeGreaterThan(0);
    for (const call of ['mountStripeRawBody(app)', 'createPublicContractsRouter()', 'createComplianceJobsRouter()', 'createDiditWebhookRouter(kycDependencies)', 'app.use(express.json(']) expect(server.indexOf(call)).toBeGreaterThan(mount);
    const files = ['server.ts', 'src/server/complianceJobs.ts', 'src/server/contracts.ts', 'src/server/routes/webhooks.ts', 'src/server/routes/complianceStorage.ts', 'src/server/routes/analytics.ts', 'src/server/routes/launch.ts', 'src/server/routes/feedback.ts', 'src/server/verification/diditKyc.ts'];
    let count = 0;
    for (const file of files) for (const match of readFileSync(file, 'utf8').matchAll(/\b(?:express\.(?:json|raw)|urlencoded|text)\(\{([^}]+)\}/g)) {
      expect(match[1], file).toMatch(/\binflate:\s*false\b/); count++;
    }
    expect(count).toBe(14);
  });
});
