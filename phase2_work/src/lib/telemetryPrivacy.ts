import type { ErrorEvent } from '@sentry/react';

// Session state is populated only after an authoritative profile read.
// Legacy browser flags never enable reporting, including before sign-in.
let diagnosticsConsent = false;

export function setDiagnosticsConsent(allowed: boolean): void {
  diagnosticsConsent = allowed === true;
}

export function hasDiagnosticsConsent(): boolean {
  return diagnosticsConsent;
}

/** Keep only stack locations in our built assets. User text, URLs, request bodies,
 * cookies, session data, breadcrumbs, contexts and custom fields are never copied.
 */
export function minimizeDiagnosticEvent(event: ErrorEvent): ErrorEvent | null {
  if (!hasDiagnosticsConsent()) return null;
  const knownTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'FirebaseError']);
  const values = event.exception?.values?.slice(0, 5).map(exception => ({
    type: knownTypes.has(exception.type ?? '') ? exception.type : 'Error',
    value: 'Client error',
    stacktrace: {
      frames: (exception.stacktrace?.frames ?? []).slice(-30).flatMap(frame => {
        try {
          const url = new URL(frame.filename ?? '', window.location.origin);
          if (url.origin !== window.location.origin || !/^\/assets\/[A-Za-z0-9_.-]+\.m?js$/.test(url.pathname)) return [];
          return [{
            filename: url.origin + url.pathname,
            lineno: Number.isSafeInteger(frame.lineno) ? frame.lineno : undefined,
            colno: Number.isSafeInteger(frame.colno) ? frame.colno : undefined,
            in_app: true,
          }];
        } catch { return []; }
      }),
    },
  }));
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: 'error',
    message: 'Client error',
    ...(values?.length ? { exception: { values } } : {}),
  };
}
