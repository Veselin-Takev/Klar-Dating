// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertSuccessfulVerificationPurgePage } from '../functions/src/verificationPurgeSchedulerResponse';

function fakeResponse(status: number, data: unknown) {
  return { status, json: async () => data };
}
function page(scanned = 0, processed = scanned, purgedCount = 0) {
  return {
    ok: true, scanned, processed, purgedCount,
    skippedCount: processed - purgedCount,
    results: Array.from({ length: processed }, () => ({ reason: 'already_purged' })),
    executedAt: 1,
  };
}

describe('signed verification storage scheduler success contract (A-15)', () => {
  it('accepts only a terminal, correctly counted 200 page', async () => {
    await expect(assertSuccessfulVerificationPurgePage(fakeResponse(200, page()))).resolves.toBeUndefined();
    await expect(assertSuccessfulVerificationPurgePage(fakeResponse(200, page(99, 99, 1)))).resolves.toBeUndefined();
  });
  it.each([202, 204, 206, 503])('rejects HTTP %i rather than reporting false scheduler success', async status => {
    await expect(assertSuccessfulVerificationPurgePage(fakeResponse(status, page()))).rejects.toThrow();
  });
  it('rejects full 100-record pages so the scheduler can retry the persisted cursor', async () => {
    await expect(assertSuccessfulVerificationPurgePage(fakeResponse(200, page(100)))).rejects.toThrow('unconfirmed page');
  });
  it.each([
    null, [], {}, { ...page(), ok: false }, { ...page(), busy: true },
    { ...page(), errors: 1 }, { ...page(), scanned: -1 }, { ...page(), scanned: 101 },
    { ...page(), scanned: 1, processed: 2 }, { ...page(), purgedCount: 2 },
    { ...page(), scanned: 0.5 }, { ...page(), results: undefined },
  ])('rejects malformed or non-success response bodies (%#)', async value => {
    await expect(assertSuccessfulVerificationPurgePage(fakeResponse(200, value))).rejects.toThrow();
  });
  it('rejects failed JSON decoding without logging any response content', async () => {
    await expect(assertSuccessfulVerificationPurgePage({
      status: 200,
      json: async () => { throw new Error('sensitive upstream body'); },
    })).rejects.toThrow('not valid JSON');
  });
});
