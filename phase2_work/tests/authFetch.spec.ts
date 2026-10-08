import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch, getValidAuthToken, installAuthFetch } from '../src/lib/authFetch';

const session = vi.hoisted(() => ({ currentUser: null as null | { uid: string; getIdToken: ReturnType<typeof vi.fn> } }));
vi.mock('../src/lib/firebase', () => ({ auth: session }));
const originalFetch = window.fetch;
let native: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  session.currentUser = { uid: 'alice', getIdToken: vi.fn().mockResolvedValue('header.payload.signature') };
  native = vi.fn().mockResolvedValue(new Response('ok'));
  window.fetch = native as typeof fetch;
});
afterEach(() => { window.fetch = originalFetch; session.currentUser = null; localStorage.clear(); });

describe('application token boundary', () => {
  it.each([
    () => `https://outside.example/?return=${window.location.origin}/api/test`,
    () => `${window.location.origin}.outside.example/api/test`,
    () => '//outside.example/api/test',
    () => `${window.location.origin}/assets/file.js`,
  ])('does not attach or obtain an app token for an external or non-API destination', async makeUrl => {
    installAuthFetch();
    const url = makeUrl(); await window.fetch(url);
    expect(native).toHaveBeenCalledWith(url, undefined);
    expect(session.currentUser!.getIdToken).not.toHaveBeenCalled();
  });

  it('attaches one current-session token to the exact app API and installs only once', async () => {
    installAuthFetch(); installAuthFetch();
    await window.fetch('/api/test', { method: 'POST', body: 'body' });
    expect(native).toHaveBeenCalledOnce(); expect(session.currentUser!.getIdToken).toHaveBeenCalledOnce();
    const options = native.mock.calls[0]![1];
    expect(options.headers.get('Authorization')).toBe('Bearer header.payload.signature');
    expect(options.method).toBe('POST'); expect(options.body).toBe('body');
  });

  it('preserves Request headers, explicit credentials and body', async () => {
    installAuthFetch();
    const request = new Request(`${window.location.origin}/api/test`, { method: 'POST', headers: { Authorization: 'Bearer explicit', 'X-Request-ID': 'request-1' }, body: 'payload' });
    await window.fetch(request);
    expect(native.mock.calls[0]![0]).toBe(request);
    expect(native.mock.calls[0]![1].headers.get('Authorization')).toBe('Bearer explicit');
    expect(native.mock.calls[0]![1].headers.get('X-Request-ID')).toBe('request-1');
    expect(await request.text()).toBe('payload');
    expect(session.currentUser!.getIdToken).not.toHaveBeenCalled();
  });

  it('never falls back to a stored token after logout or token failure', async () => {
    localStorage.setItem('klar_auth_token', 'stale.account.token');
    session.currentUser!.getIdToken.mockRejectedValue(new Error('expired'));
    expect(await getValidAuthToken()).toBeNull();
    session.currentUser = null;
    expect(await getValidAuthToken()).toBeNull();
  });

  it('discards a token resolved after the account changed', async () => {
    let finish!: (token: string) => void;
    session.currentUser!.getIdToken.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = getValidAuthToken();
    session.currentUser = { uid: 'bob', getIdToken: vi.fn() };
    finish('alice.old.token');
    expect(await pending).toBeNull(); expect(localStorage.getItem('klar_auth_token')).toBeNull();
  });

  it('rejects an external authenticated helper request before any network operation', async () => {
    await expect(authFetch(`https://outside.example/?${window.location.origin}`)).rejects.toThrow('same-origin');
    expect(native).not.toHaveBeenCalled(); expect(session.currentUser!.getIdToken).not.toHaveBeenCalled();
  });
});
