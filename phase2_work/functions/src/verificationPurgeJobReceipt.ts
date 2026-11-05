/**
 * The scheduled worker must not treat HTTP 200 alone as proof that a
 * privacy-sensitive purge pass has completed. All values are aggregate-only:
 * never include a UID, object path, nonce, HMAC or request content in logs.
 */
export type VerificationPurgeJobReceipt = {
  processed: number;
  purgedCount: number;
  skippedCount: number;
  failedCount: 0;
  pages: number;
};

export function assertCompleteVerificationPurgeReceipt(value: unknown): VerificationPurgeJobReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('verification_purge_job_receipt_invalid');
  }
  const data = value as Record<string, unknown>;
  const fields = ['processed', 'purgedCount', 'skippedCount', 'failedCount', 'pages'] as const;
  if (fields.some(field => typeof data[field] !== 'number'
    || !Number.isSafeInteger(data[field])
    || (data[field] as number) < 0)
    || data.processed !== (data.purgedCount as number) + (data.skippedCount as number) + (data.failedCount as number)) {
    throw Error('verification_purge_job_receipt_invalid');
  }
  // A previous protocol version without the durable unresolved-failure latch
  // must fail closed until the scheduler and API are updated together.
  if (data.ok !== true || data.hasMore !== false || data.unresolvedFailureBacklog !== false || data.failedCount !== 0) {
    throw Error('verification_purge_job_incomplete');
  }
  return {
    processed: data.processed as number,
    purgedCount: data.purgedCount as number,
    skippedCount: data.skippedCount as number,
    failedCount: 0,
    pages: data.pages as number,
  };
}
