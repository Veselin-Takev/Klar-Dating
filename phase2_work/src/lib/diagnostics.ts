import * as Sentry from '@sentry/react';
import { hasDiagnosticsConsent } from './telemetryPrivacy';

/** No event payload reaches the SDK without the current session's consent.
 * beforeSend independently minimizes automatic and explicit exceptions.
 */
export function reportClientError(error: unknown): string | null {
  if (!hasDiagnosticsConsent()) return null;
  try {
    return Sentry.captureException(error instanceof Error ? error : new Error('Client error'));
  } catch {
    return null;
  }
}
