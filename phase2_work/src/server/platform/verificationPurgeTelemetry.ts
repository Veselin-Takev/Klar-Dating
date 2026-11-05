import type { PurgeScanResult } from './verificationPurgeScan';

/**
 * This record is deliberately allowlisted: no Firestore document identifier,
 * uid, storage path, exception message, token, signed body or user object.
 * It is appropriate for Cloud Logging aggregate operational alerts.
 */
export function verificationPurgeIncompleteEvent(
  result: Pick<PurgeScanResult, 'scanned' | 'failed' | 'pages' | 'hasMore'>,
  unresolvedFailureBacklog: boolean,
) {
  return {
    event: 'verification_photo_purge_incomplete' as const,
    severity: (result.failed > 0 || unresolvedFailureBacklog ? 'ERROR' : 'WARNING') as 'ERROR' | 'WARNING',
    processed: result.scanned,
    failedCount: result.failed,
    pages: result.pages,
    hasMore: result.hasMore,
    unresolvedFailureBacklog,
  };
}

/** The precise exception is intentionally omitted to prevent PII in logs. */
export function verificationPurgeUnavailableEvent() {
  return { event: 'verification_photo_purge_unavailable' as const, severity: 'ERROR' as const };
}

/** Logs attempted production use, never an authorization to delete anything. */
export function verificationPurgeP0BlockedEvent() {
  return { event: 'verification_photo_purge_p0_live_blocked' as const, severity: 'ERROR' as const };
}
