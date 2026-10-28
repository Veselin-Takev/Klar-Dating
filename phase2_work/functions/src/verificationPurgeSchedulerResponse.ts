/**
 * A scheduled scan is not a successful maintenance run merely because an
 * endpoint returns a 2xx status. The signed endpoint uses:
 *  - 200 for a successfully evaluated page,
 *  - 202 for a worker currently owned by another invocation,
 *  - 503 for errors (including partial failures with an advanced cursor).
 *
 * Reject a full page, too: with a strict 100-row limit the next keyset
 * page may contain still-due items. Cloud Scheduler retries must not falsely
 * acknowledge completion of a multi-page scan. Never log the response body:
 * its results include account identifiers and storage paths.
 */
export interface VerificationPurgeHttpResponse {
  status: number;
  json(): Promise<unknown>;
}

const MAX_PAGE = 100;

export async function assertSuccessfulVerificationPurgePage(
  response: VerificationPurgeHttpResponse,
): Promise<void> {
  if (response.status !== 200) {
    throw new Error(`Verification storage purge not confirmed: HTTP ${response.status}`);
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error('Verification storage purge response is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Verification storage purge response has invalid shape');
  }
  const value = parsed as Record<string, unknown>;
  const counter = (key: string): number => {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
      throw new Error('Verification storage purge response has invalid counters');
    }
    return n;
  };
  const scanned = counter('scanned');
  const processed = counter('processed');
  const purgedCount = counter('purgedCount');
  const skippedCount = counter('skippedCount');
  const results = value.results;
  if (value.ok !== true || value.busy === true || value.errors !== undefined
    || scanned > MAX_PAGE || processed > scanned || purgedCount > processed
    || purgedCount + skippedCount !== processed
    || !Array.isArray(results) || results.length !== processed) {
    throw new Error('Verification storage purge response is not confirmed');
  }
  if (scanned === MAX_PAGE) {
    // A successful but full page does not prove that all due rows were scanned.
    throw new Error('Verification storage purge has another unconfirmed page');
  }
}
