// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null },
  melde: vi.fn(),
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('../src/lib/fehler', () => ({ melde: mocks.melde }));
vi.mock('../src/lib/wiederholung', () => ({ sollWiederholen: () => false }));

import { fetchWithTimeout, monitoredFetch } from '../src/lib/api';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mocks.auth.currentUser = null;
  mocks.melde.mockReset();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('profile token telemetry privacy', () => {
  it('emits only a sanitized route and generic message for fetch failures', async () => {
    const secretUrl = 'https://klar.example/api/profile-media/person-1/klar-media%3Av1%3AYWJj?alt=media&token=download-secret';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error(`fetch failed for ${secretUrl}`)) as typeof fetch;
    let detail: unknown;
    const listener = (event: Event) => { detail = (event as CustomEvent).detail; };
    window.addEventListener('klar_api_error', listener);
    try {
      await expect(fetchWithTimeout(secretUrl, { retries: 0 })).rejects.toThrow('Netzwerkfehler');
    } finally {
      window.removeEventListener('klar_api_error', listener);
    }
    const serialized = JSON.stringify(detail);
    expect(serialized).toContain('/api/profile-media/:uid/:mediaRef');
    expect(serialized).not.toContain('person-1');
    expect(serialized).not.toContain('download-secret');
    expect(serialized).not.toContain('?alt=media');
    expect(serialized).toContain('Netzwerkfehler');
  });

  it('sends monitored-fetch diagnostics without the raw URL or original error content', async () => {
    const secretUrl = 'https://klar.example/api/profile-media/person-1/klar-media%3Av1%3AYWJj?token=download-secret';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error(`server returned ${secretUrl}`)) as typeof fetch;
    await expect(monitoredFetch(secretUrl)).rejects.toThrow('Netzwerkfehler');
    expect(mocks.melde).toHaveBeenCalledOnce();
    const diagnostic = JSON.stringify(mocks.melde.mock.calls);
    expect(diagnostic).toContain('/api/profile-media/:uid/:mediaRef');
    expect(diagnostic).not.toContain('person-1');
    expect(diagnostic).not.toContain('download-secret');
    expect(diagnostic).not.toContain('server returned');
  });
});
