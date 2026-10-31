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

/**
 * scanPurgePages only counts nonempty pages. Every page before the last
 * contains 25 rows; on the fourth full page it returns hasMore:true.
 * A "complete" receipt can therefore never claim 100 rows in 4 pages.
 */
const MAX_PURGE_PAGE_SIZE = 25;
function validPageExtent(processed: unknown, pages: unknown): boolean {
  if (!validCount(processed) || !validCount(pages)) return false;
  if (pages === 0) return processed === 0;
  return processed > (pages - 1) * MAX_PURGE_PAGE_SIZE
    && processed <= pages * MAX_PURGE_PAGE_SIZE
    && !(pages === 4 && processed === 100);
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
      !validPageExtent(receipt.processed, receipt.pages) ||
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
