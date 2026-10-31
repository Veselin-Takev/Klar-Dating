/**
 * Compliance scheduler may acknowledge a purge cycle only with a bounded,
 * internally consistent, *complete* success receipt from its signed API.
 * This is response-contract validation, not independent GCS erasure evidence.
 */
const MAX_PURGE_RESPONSE_BYTES = 2048;

type PurgeCompletion = {
  ok: true;
  processed: number;
  purgedCount: number;
  skippedCount: number;
  failedCount: 0;
  pages: number;
  hasMore: false;
  unresolvedEarlierPages: false;
};

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function assertCompletedVerificationPurge(value: unknown): asserts value is PurgeCompletion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('verification_purge_response_invalid');
  }
  const receipt = value as Record<string, unknown>;
  if (receipt.ok !== true ||
      receipt.hasMore !== false ||
      receipt.unresolvedEarlierPages !== false ||
      receipt.failedCount !== 0 ||
      !validCount(receipt.processed) ||
      !validCount(receipt.purgedCount) ||
      !validCount(receipt.skippedCount) ||
      !validCount(receipt.pages) ||
      receipt.pages > 4 ||
      receipt.processed > 100 ||
      receipt.purgedCount + receipt.skippedCount !== receipt.processed) {
    throw new Error('verification_purge_response_incomplete_or_invalid');
  }
}

/** Hard cap the decoded stream, rather than trusting Content-Length or JSON. */
export async function assertPurgeSchedulerResponse(response: Response): Promise<void> {
  if (response.status !== 200) throw new Error('verification_purge_http_not_success');
  const type = response.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|\s*$)/i.test(type)) {
    throw new Error('verification_purge_response_type_invalid');
  }
  const announced = response.headers.get('content-length');
  if (announced && /^\d+$/.test(announced.trim()) && Number(announced) > MAX_PURGE_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error('verification_purge_response_too_large');
  }
  if (!response.body) throw new Error('verification_purge_response_missing');
  const reader = response.body.getReader();
  const buffer = new Uint8Array(MAX_PURGE_RESPONSE_BYTES);
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_PURGE_RESPONSE_BYTES - used) {
        throw new Error('verification_purge_response_too_large');
      }
      buffer.set(value, used);
      used += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, used))) as unknown;
  } catch {
    throw new Error('verification_purge_response_json_invalid');
  }
  assertCompletedVerificationPurge(payload);
}
