import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { GlobalApiOverlay } from '../src/components/GlobalApiOverlay';
import { setDiagnosticsConsent } from '../src/lib/telemetryPrivacy';
import { monitoredFetch, monitorFirestoreOp } from '../src/lib/perfMonitor';
import { OperationType } from '../src/lib/firebaseUtils';
import { melde } from '../src/lib/fehler';

vi.mock('@sentry/react', () => ({ captureException: vi.fn(() => 'event'), startSpan: vi.fn(), metrics: { distribution: vi.fn() } }));
beforeEach(() => { setDiagnosticsConsent(false); vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); setDiagnosticsConsent(false); });

describe('all explicit diagnostic paths', () => {
  it('announces API errors without recording payloads or bypassing consent', () => {
    render(<GlobalApiOverlay />);
    const emit = () => act(() => window.dispatchEvent(new CustomEvent('klar_api_error', {
      detail: { message: 'private-token', url: '/chat/private-user?token=private-token', headers: { Authorization: 'private-token' } },
    })));
    emit(); expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).not.toHaveTextContent('private-token');
    setDiagnosticsConsent(true); emit();
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.captureException).mock.calls[0]).toHaveLength(1);
    expect((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message).toBe('API request failed');
    setDiagnosticsConsent(false); emit(); expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  it('preserves fetch errors while disabling browser metrics and traces', async () => {
    const failed = new Response('{}', { status: 503 });
    const fetcher = vi.fn().mockResolvedValue(failed);
    expect(await monitoredFetch('/private?token=secret', {}, fetcher)).toBe(failed);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    setDiagnosticsConsent(true);
    await monitoredFetch('/private?token=secret', {}, fetcher);
    expect((vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error).message).not.toContain('secret');
    expect(Sentry.startSpan).not.toHaveBeenCalled(); expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
    const error = new Error('network'); fetcher.mockRejectedValueOnce(error);
    await expect(monitoredFetch('/private', {}, fetcher)).rejects.toBe(error);
  });

  it('does not report or persist error logs without consent', async () => {
    const error = new Error('private-profile');
    await expect(monitorFirestoreOp(OperationType.GET, 'users/private', async () => { throw error; })).rejects.toBe(error);
    melde('test', error, { profile: 'private-profile' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(localStorage.getItem('klar_client_errors')).toBeNull();
  });
});
