import { monitoredFetch } from '../src/lib/apiMonitor';
import * as Sentry from '@sentry/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setDiagnosticsConsent } from '../src/lib/telemetryPrivacy';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  startSpan: vi.fn(),
  metrics: {
    distribution: vi.fn(),
  },
}));

describe('monitoredFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    setDiagnosticsConsent(false);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setDiagnosticsConsent(false);
  });

  it('preserves the response without emitting browser metrics, traces or request details', async () => {
    const response = new Response('ok', { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(response);
    setDiagnosticsConsent(true);
    expect(await monitoredFetch('/api/private?token=secret', { method: 'POST' })).toBe(response);
    expect(global.fetch).toHaveBeenCalledWith('/api/private?token=secret', { method: 'POST' });
    expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
    expect(Sentry.startSpan).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('preserves network errors while requiring consent and minimizing optional reports', async () => {
    const error = new Error('Network error with private-token');
    global.fetch = vi.fn().mockRejectedValue(error);
    await expect(monitoredFetch('/api/error?token=secret')).rejects.toBe(error);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    setDiagnosticsConsent(true);
    await expect(monitoredFetch('/api/error?token=secret')).rejects.toBe(error);
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.captureException).mock.calls[0]).toHaveLength(1);
    expect((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message).toBe('Network request failed');
    expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
    expect(Sentry.startSpan).not.toHaveBeenCalled();
  });
});
