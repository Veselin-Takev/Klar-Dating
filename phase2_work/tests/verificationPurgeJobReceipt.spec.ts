// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  assertCompleteVerificationPurgeReceipt, readBoundedVerificationPurgeReceipt,
  verificationPurgeSchedulerFailureEvent,
} from '../functions/src/verificationPurgeJobReceipt';

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


describe('streaming byte bound for purge scheduler receipts', () => {
  const json = (value: unknown) => new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

  it('accepts valid JSON and exactly 2048 bytes without truncation', async () => {
    expect(await readBoundedVerificationPurgeReceipt(json(complete))).toMatchObject({
      processed: 3, failedCount: 0,
    });
    const payload = JSON.stringify(complete);
    const exact = payload + ' '.repeat(2_048 - Buffer.byteLength(payload));
    expect(Buffer.byteLength(exact)).toBe(2_048);
    expect((await readBoundedVerificationPurgeReceipt(new Response(exact, {
      headers: { 'content-type': 'application/json' },
    }))).processed).toBe(3);
  });

  it('stops an oversized stream early without reading the rest', async () => {
    let pulls = 0;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(1_100)); },
      cancel() { canceled = true; },
    }, { highWaterMark: 0 });
    await expect(readBoundedVerificationPurgeReceipt(new Response(stream, {
      headers: { 'content-type': 'application/json' },
    }))).rejects.toThrow('verification_purge_job_receipt_oversize');
    expect(canceled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it('cancels a non-JSON upstream body without reading it', async () => {
    let pulled = false;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulled = true; controller.enqueue(new Uint8Array(500)); },
      cancel() { canceled = true; },
    }, { highWaterMark: 0 });
    const response = new Response(stream, { headers: { 'content-type': 'text/html' } });
    await expect(readBoundedVerificationPurgeReceipt(response))
      .rejects.toThrow('verification_purge_job_receipt_content_type_invalid');
    expect(canceled).toBe(true);
    expect(pulled).toBe(false);
  });

  it('rejects an announced oversized response before reading any chunk', async () => {
    let pulled = false;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulled = true; controller.enqueue(new Uint8Array([123])); controller.close(); },
      cancel() { canceled = true; },
    }, { highWaterMark: 0 });
    await expect(readBoundedVerificationPurgeReceipt(new Response(stream, {
      headers: { 'content-type': 'application/json', 'content-length': '2049' },
    }))).rejects.toThrow('verification_purge_job_receipt_oversize');
    expect(pulled).toBe(false);
    expect(canceled).toBe(true);
  });

  it.each([
    ['bad JSON', new Response('not JSON', { headers: { 'content-type': 'application/json' } })],
    ['untrusted HTML', new Response('{}', { headers: { 'content-type': 'text/html' } })],
    ['missing body', new Response(null, { headers: { 'content-type': 'application/json' } })],
    ['malformed UTF8', new Response(Buffer.from([0xff]), { headers: { 'content-type': 'application/json' } })],
    ['partial pass', json({ ...complete, hasMore: true })],
  ] as const)('rejects %s instead of acknowledging a purge', async (_description, response) => {
    await expect(readBoundedVerificationPurgeReceipt(response)).rejects.toThrow(/verification_purge_job_/);
  });
});


describe('scheduler failure diagnostics are aggregate-only', () => {
  it('classifies transport failures without exception or endpoint content', () => {
    expect(verificationPurgeSchedulerFailureEvent('transport')).toEqual({
      event: 'verification_photo_purge_scheduler_failed',
      severity: 'ERROR', stage: 'transport',
    });
  });
  it('records only numeric HTTP status for upstream failure', () => {
    expect(verificationPurgeSchedulerFailureEvent('http', 503)).toEqual({
      event: 'verification_photo_purge_scheduler_failed',
      severity: 'ERROR', stage: 'http', httpStatus: 503,
    });
    expect(verificationPurgeSchedulerFailureEvent('http', NaN)).not.toHaveProperty('httpStatus');
  });
  it('never logs a raw receipt or error description for malformed replies', () => {
    expect(verificationPurgeSchedulerFailureEvent('receipt')).toEqual({
      event: 'verification_photo_purge_scheduler_failed',
      severity: 'ERROR', stage: 'receipt',
    });
  });
});
