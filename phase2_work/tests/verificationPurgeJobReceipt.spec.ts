// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { assertCompleteVerificationPurgeReceipt, readBoundedVerificationPurgeReceipt } from '../functions/src/verificationPurgeJobReceipt';

const complete = {
  ok: true, processed: 3, purgedCount: 2, skippedCount: 1,
  failedCount: 0, pages: 1, hasMore: false, unresolvedFailureBacklog: false,
};

describe('verification purge scheduler receipt is fail-closed', () => {
  it('accepts an internally consistent, completed aggregate-only receipt', () => {
    expect(assertCompleteVerificationPurgeReceipt(complete)).toEqual({
      processed: 3, purgedCount: 2, skippedCount: 1, failedCount: 0, pages: 1,
    });
    expect(assertCompleteVerificationPurgeReceipt({
      ...complete, processed: 0, purgedCount: 0, skippedCount: 0, pages: 0,
    })).toMatchObject({ processed: 0, failedCount: 0 });
  });

  it.each([
    null, [], true, {}, { ...complete, ok: false },
    { ...complete, hasMore: true },
    { ...complete, unresolvedFailureBacklog: true },
    { ...complete, unresolvedFailureBacklog: undefined },
    { ...complete, failedCount: 1, processed: 4 },
    { ...complete, processed: 4 },
    { ...complete, processed: '3' },
    { ...complete, pages: -1 },
    { ...complete, pages: Number.NaN },
    { ...complete, purgedCount: Number.POSITIVE_INFINITY },
    { ...complete, skippedCount: 0.5 },
    { ...complete, failedCount: -1 },
  ])('rejects a false, incomplete or malformed HTTP-success receipt: %#', value => {
    expect(() => assertCompleteVerificationPurgeReceipt(value)).toThrow(
      /verification_purge_job_(?:receipt_invalid|incomplete)/,
    );
  });
});
