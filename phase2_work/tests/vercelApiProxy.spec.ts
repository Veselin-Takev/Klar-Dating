// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { proxyKlarApi } from '../api/proxy';

const backendHost = 'klar-backend-abc.a.run.app';
const env = {
  KLAR_API_UPSTREAM_ORIGIN: 'https://' + backendHost,
  KLAR_API_ALLOWED_HOST: backendHost,
} as NodeJS.ProcessEnv;

const ageRequest = (method = 'POST') => new Request(
  'https://klar-dating.vercel.app/api/account/alter',
  {
    method,
    headers: {
      authorization: 'Bearer dummy-test-token',
      'content-type': 'application/json',
      'x-forwarded-host': 'attacker.example',
    },
    ...(method === 'POST' ? { body: JSON.stringify({ geburtsdatum: '2000-01-01' }) } : {}),
  },
);

describe('Vercel Vite API proxy — fail closed before production release', () => {
  it('returns 503 without an approved backend and never fabricates adult status', async () => {
    const send = vi.fn<typeof fetch>();
    const response = await proxyKlarApi(ageRequest(), {}, send);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'api_upstream_not_configured' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['http://klar-backend-abc.a.run.app', backendHost],
    ['https://klar-backend-abc.a.run.app', 'wrong-backend.run.app'],
    ['https://localhost', 'localhost'],
    ['https://127.0.0.1', '127.0.0.1'],
    ['https://klar-dating.vercel.app', 'klar-dating.vercel.app'],
    ['https://user:password@klar-backend-abc.a.run.app', backendHost],
    ['https://klar-backend-abc.a.run.app/unsafe', backendHost],
  ])('rejects unsafe upstream URL or mismatched pin (%s)', async (raw, pinned) => {
    const send = vi.fn<typeof fetch>();
    const response = await proxyKlarApi(ageRequest(), {
      KLAR_API_UPSTREAM_ORIGIN: raw,
      KLAR_API_ALLOWED_HOST: pinned,
    }, send);
    expect(response.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('proxies an account request to exactly the pinned HTTPS backend, not client headers', async () => {
    const send = vi.fn(async (url: URL | RequestInfo, options?: RequestInit) => {
      expect(String(url)).toBe('https://' + backendHost + '/api/account/alter');
      const headers = new Headers(options?.headers);
      expect(headers.get('authorization')).toBe('Bearer dummy-test-token');
      expect(headers.get('x-forwarded-host')).toBeNull();
      expect(options?.method).toBe('POST');
      expect(new TextDecoder().decode(options?.body as ArrayBuffer)).toContain('geburtsdatum');
      return Response.json({ code: 'unauthorized' }, {
        status: 401,
        headers: { 'set-cookie': 'do-not-forward=true', 'cache-control': 'public, max-age=100' },
      });
    }) as typeof fetch;
    const response = await proxyKlarApi(ageRequest(), env, send);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('unauthorized');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts Vercel captured API path and retains normal query parameters', async () => {
    const request = new Request(
      'https://klar-dating.vercel.app/api/proxy?__klar_api_path=account/status&lang=de',
    );
    const send = vi.fn(async (url: URL | RequestInfo) => {
      expect(String(url)).toBe('https://' + backendHost + '/api/account/status?lang=de');
      return Response.json({ code: 'unauthorized' }, { status: 401 });
    }) as typeof fetch;
    expect((await proxyKlarApi(request, env, send)).status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate injected routes and path traversal without forwarding', async () => {
    const send = vi.fn<typeof fetch>();
    for (const address of [
      'https://klar-dating.vercel.app/api/proxy?__klar_api_path=account/status&__klar_api_path=account/delete',
      'https://klar-dating.vercel.app/api/proxy?__klar_api_path=../admin',
      'https://klar-dating.vercel.app/api/proxy?__klar_api_path=https://attacker.example',
    ]) {
      const response = await proxyKlarApi(new Request(address), env, send);
      expect(response.status).toBe(400);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects oversized payloads before contacting the backend', async () => {
    const send = vi.fn<typeof fetch>();
    const request = new Request(
      'https://klar-dating.vercel.app/api/account/alter',
      { method: 'POST', body: 'x'.repeat(901 * 1024) },
    );
    expect((await proxyKlarApi(request, env, send)).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed on upstream network failures, rather than reporting successful verification', async () => {
    const send = vi.fn(async () => { throw new Error('connect ETIMEDOUT'); }) as typeof fetch;
    const response = await proxyKlarApi(ageRequest(), env, send);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'api_upstream_unreachable' });
  });

  it('never follows an upstream redirect carrying Firebase authorization', async () => {
    const send = vi.fn(async () => new Response(null, {
      status: 302, headers: { Location: 'https://attacker.example' },
    })) as typeof fetch;
    const response = await proxyKlarApi(ageRequest(), env, send);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'api_upstream_redirect_rejected' });
    expect(response.headers.has('location')).toBe(false);
  });
});
