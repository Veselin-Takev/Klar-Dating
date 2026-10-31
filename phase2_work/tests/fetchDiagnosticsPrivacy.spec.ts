// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ melde: vi.fn() }));
vi.mock('../src/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../src/lib/fehler', () => ({ melde: calls.melde }));
import { fetchWithTimeout, monitoredFetch } from '../src/lib/api';

const secret = 'sensitive-profile-firebase-download-token';
const secretUrl = 'https://firebasestorage.googleapis.com/v0/b/owner/o/path%2Fuser?alt=media&token=' + secret;

beforeEach(() => {
  calls.melde.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('client fetch privacy boundary (P1 #206)', () => {
  it('never logs query credentials even for slow requests', async () => {
    const result = new Response('ok', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(result);
    vi.stubGlobal('fetch', fetchMock);
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(600);
    vi.stubGlobal('performance', { now });
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(await monitoredFetch(secretUrl)).toBe(result);
    expect(fetchMock).toHaveBeenCalledWith(secretUrl, undefined);
    expect(debug).toHaveBeenCalledOnce();
    const diagnostic = debug.mock.calls.flat().join(' ');
    expect(diagnostic).toContain('600ms');
    expect(diagnostic).not.toContain(secret);
    expect(diagnostic).not.toContain('firebasestorage');
    expect(diagnostic).not.toContain('user');
    expect(calls.melde).not.toHaveBeenCalled();
  });

  it('preserves a rejected fetch but sends only a fixed sanitized diagnostic', async () => {
    const original = new Error('Failed for ' + secretUrl);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await expect(monitoredFetch(new Request(secretUrl))).rejects.toBe(original);
    expect(calls.melde).toHaveBeenCalledOnce();
    const [context, sanitized] = calls.melde.mock.calls[0] as [string, Error];
    expect(context).toBe('http_request_failed');
    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.message).toBe('Network request failed');
    expect(String(context) + sanitized.stack).not.toContain(secret);
    expect(debug).not.toHaveBeenCalled();
  });

  it('dispatches no URL/query string or caught exception message on timeout-client error event', async () => {
    const original = new Error('Private query ' + secret);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original));
    const events: Record<string, unknown>[] = [];
    const listener = (ev: Event) => events.push((ev as CustomEvent).detail as Record<string, unknown>);
    window.addEventListener('klar_api_error', listener);
    try {
      await expect(fetchWithTimeout(secretUrl, { retries: 0 })).rejects.toBe(original);
      expect(events).toEqual([{ message: 'Netzwerkfehler', url: '[redacted]' }]);
      expect(JSON.stringify(events)).not.toContain(secret);
      expect(JSON.stringify(events)).not.toContain('firebasestorage');
    } finally {
      window.removeEventListener('klar_api_error', listener);
    }
  });
});
