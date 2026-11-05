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
    || !Number.isSafeInteger(data[field] as number)
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


/** Read a scheduler receipt with a hard, on-the-wire byte limit.
 * response.text() buffers the whole response before a post-hoc length check;
 * a malformed upstream response could exhaust memory before validation.
 * Fail closed on missing/non-JSON bodies and malformed UTF-8.
 */
export async function readBoundedVerificationPurgeReceipt(
  response: Pick<Response, 'headers' | 'body'>,
): Promise<VerificationPurgeJobReceipt> {
  const MAX_BYTES = 2_048;
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw Error('verification_purge_job_receipt_content_type_invalid');
  }
  const announcedLength = response.headers.get('content-length');
  if (announcedLength !== null
    && (!/^[0-9]+$/.test(announcedLength)
      || !Number.isSafeInteger(Number(announcedLength))
      || Number(announcedLength) > MAX_BYTES)) {
    throw Error('verification_purge_job_receipt_oversize');
  }
  if (!response.body) throw Error('verification_purge_job_receipt_empty');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) {
        throw Error('verification_purge_job_receipt_stream_invalid');
      }
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) {
        // Stop upstream delivery immediately rather than buffering the rest.
        await reader.cancel().catch(() => undefined);
        throw Error('verification_purge_job_receipt_oversize');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try {
    const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), bytes));
    parsed = JSON.parse(body);
  } catch {
    throw Error('verification_purge_job_receipt_json_invalid');
  }
  return assertCompleteVerificationPurgeReceipt(parsed);
}
