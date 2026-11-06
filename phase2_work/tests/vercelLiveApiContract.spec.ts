// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { probeVercelApi } from '../scripts/check-vercel-live-api.mjs';

const base = 'https://klar-dating-review123.vercel.app/';

const reply = (status: number, body: unknown = { error: 'Unauthorized' }) =>
  Response.json(body, { status });

describe('Vercel preview deployed API contract', () => {
  it('accepts anonymous 401 for account status and 401 for age', async () => {
    const send = vi.fn(async (url: URL) => {
      expect(url.origin).toBe(new URL(base).origin);
      return reply(401);
    }) as typeof fetch;
    await expect(probeVercelApi(base, send)).resolves.toMatchObject({ ok: true });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('rejects Vite SPA 404, even when first response has JSON', async () => {
    const send = vi.fn(async () => reply(404)) as typeof fetch;
    await expect(probeVercelApi(base, send))
      .rejects.toThrow('vercel_api_backend_unavailable');
  });

  it('rejects backend-not-configured 503, no false age verification', async () => {
    const send = vi.fn(async () => reply(503, { code: 'api_upstream_not_configured' })) as typeof fetch;
    await expect(probeVercelApi(base, send))
      .rejects.toThrow('vercel_api_backend_unavailable');
  });

  it('rejects static HTML or an unprotected personal account status route', async () => {
    const html = vi.fn(async () => new Response('<!doctype html>', {
      status: 200, headers: { 'content-type': 'text/html' },
    })) as typeof fetch;
    await expect(probeVercelApi(base, html)).rejects.toThrow('vercel_api_not_json');
    const unprotected = vi.fn(async () => reply(200, { ok: true, isAdult: true })) as typeof fetch;
    await expect(probeVercelApi(base, unprotected))
      .rejects.toThrow('vercel_account_status_auth_boundary_missing');
  });

  it('rejects malformed age response in place of age server route', async () => {
    let count = 0;
    const send = vi.fn(async () => {
      count++;
      return count === 1 ? reply(401) : reply(400, { error: 'other' });
    }) as typeof fetch;
    await expect(probeVercelApi(base, send))
      .rejects.toThrow('vercel_account_age_invalid_response');
  });

  it('rejects unknown / plain HTTP preview targets', async () => {
    const send = vi.fn<typeof fetch>();
    await expect(probeVercelApi('http://localhost:3000/', send))
      .rejects.toThrow('vercel_probe_invalid_target');
    expect(send).not.toHaveBeenCalled();
  });
});
