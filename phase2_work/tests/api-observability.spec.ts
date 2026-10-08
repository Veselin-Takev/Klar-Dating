import { describe, expect, it } from 'vitest';

const API_HOST = 'http://localhost:3000';

describe('operational endpoints', () => {
  it('returns liveness without exposing internals', async () => {
    const response = await fetch(`${API_HOST}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('continues an incoming W3C trace with a new server span', async () => {
    const traceId = '0123456789abcdef0123456789abcdef';
    const response = await fetch(`${API_HOST}/api/health`, {
      headers: { traceparent: `00-${traceId}-0123456789abcdef-01` },
    });
    expect(response.headers.get('x-trace-id')).toBe(traceId);
    expect(response.headers.get('traceparent')).toMatch(
      new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`),
    );
  });

  it('reports dependency readiness', async () => {
    const response = await fetch(`${API_HOST}/api/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('hides metrics when no monitoring token is configured', async () => {
    const response = await fetch(`${API_HOST}/api/metrics`);
    expect(response.status).toBe(404);
  });
});
