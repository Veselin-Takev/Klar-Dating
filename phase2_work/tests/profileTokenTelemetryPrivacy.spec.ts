// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../src/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../src/lib/fehler', () => ({ melde: vi.fn() }));
import { melde } from '../src/lib/fehler';
import { monitoredFetch } from '../src/lib/api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const capabilityUrl = 'https://firebasestorage.googleapis.com/v0/b/demo/o/profiles%2Fperson-photo.jpg?alt=media&token=CANARY-SECRET-CAPABILITY';

describe('token-bearing request telemetry privacy', () => {
  it('token-bearing requests preserve fetch semantics without logging URL or query', async () => {
    const response = new Response('success', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(850);
    const request = new Request(capabilityUrl);
    expect(await monitoredFetch(request)).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(request, undefined);
    expect(debug).toHaveBeenCalledOnce();
    const text = JSON.stringify(debug.mock.calls);
    expect(text).toContain('750ms');
    expect(text).not.toContain('CANARY-SECRET-CAPABILITY');
    expect(text).not.toContain('person-photo');
    expect(text).not.toContain('firebasestorage.googleapis.com');
    expect(melde).not.toHaveBeenCalled();
  });

  it('preserves the original network rejection but sends only synthetic diagnostics', async () => {
    const error = new Error('Request failed at ' + capabilityUrl);
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('fetch', fetchMock);
    await expect(monitoredFetch(capabilityUrl)).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledWith(capabilityUrl, undefined);
    expect(melde).toHaveBeenCalledOnce();
    const [label, captured] = vi.mocked(melde).mock.calls[0]!;
    expect(label).toBe('Fetch/network');
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe('Network request failed');
    expect(JSON.stringify([label, String(captured)])).not.toContain('CANARY-SECRET-CAPABILITY');
  });

  it('the active server Helmet referrer policy and secondary middleware are no-referrer', () => {
    const server = readFileSync('server.ts', 'utf8');
    const headers = readFileSync('src/server/securityHeaders.ts', 'utf8');
    expect(server).toMatch(/referrerPolicy:\s*\{\s*policy:\s*'no-referrer'\s*\}/);
    expect(headers).toContain('res.setHeader("Referrer-Policy", "no-referrer")');
  });
});
