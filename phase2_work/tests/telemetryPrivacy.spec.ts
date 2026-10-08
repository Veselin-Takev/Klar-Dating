import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { minimizeDiagnosticEvent, setDiagnosticsConsent } from '../src/lib/telemetryPrivacy';

const event: ErrorEvent = {
  type: undefined,
  event_id: '0123456789abcdef0123456789abcdef',
  timestamp: 123,
  message: 'private-message',
  user: { email: 'private@example.test' },
  request: { url: 'https://private.example.test/chat/private-id', cookies: { token: 'private-cookie' } },
  extra: { profile: 'private-profile' },
  contexts: { trace: { span_id: '0123456789abcdef', trace_id: '0123456789abcdef0123456789abcdef', data: { detail: 'private-detail' } } },
  breadcrumbs: [{ message: 'private-breadcrumb' }],
  exception: { values: [{
    type: 'TypeError', value: 'private-exception',
    stacktrace: { frames: [
      { filename: window.location.origin + '/assets/app-a1b2.js?token=private-token', lineno: 17, colno: 3, vars: { secret: 'private-var' } },
      { filename: 'https://private.example.test/private-module.js', lineno: 1 },
      { filename: window.location.origin + '/chat/private-user', lineno: 1 },
    ] },
  }] },
};
afterEach(() => { setDiagnosticsConsent(false); localStorage.clear(); vi.restoreAllMocks(); });

describe('diagnostic data boundary', () => {
  it('requires current consent and respects withdrawal', () => {
    expect(minimizeDiagnosticEvent(event)).toBeNull();
    setDiagnosticsConsent(true);
    expect(minimizeDiagnosticEvent(event)).not.toBeNull();
    setDiagnosticsConsent(false);
    expect(minimizeDiagnosticEvent(event)).toBeNull();
  });
  it('retains actionable asset locations without user or request content', () => {
    setDiagnosticsConsent(true);
    const clean = minimizeDiagnosticEvent(event);
    expect(JSON.stringify(clean)).not.toContain('private');
    expect(clean?.exception?.values?.[0]?.stacktrace?.frames).toEqual([{
      filename: window.location.origin + '/assets/app-a1b2.js', lineno: 17, colno: 3, in_app: true,
    }]);
    expect(event.message).toBe('private-message');
  });
  it('ignores forged legacy storage flags', () => {
    localStorage.setItem('klar_einw_fehlerberichte', 'ja');
    expect(minimizeDiagnosticEvent(event)).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(minimizeDiagnosticEvent(event)).toBeNull();
  });
});
