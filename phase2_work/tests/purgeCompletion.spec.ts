// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertCompletedVerificationPurge,
  assertPurgeSchedulerResponse,
} from '../functions/src/purgeCompletion';

// These synthetic HTTP responses do not access Cloud Functions, GCS or Firebase.
const complete = {
  ok: true, processed: 3, purgedCount: 2, skippedCount: 1,
  failedCount: 0, hasMore: false, unresolvedEarlierPages: false, pages: 1,
};
const response = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), {
    status, headers: { 'content-type': type },
  });

describe('scheduled verification-photo purge completion contract (P0 #202)', () => {
  it('acknowledges a coherent final summary including a no-due-events empty sweep', async () => {
    await expect(assertPurgeSchedulerResponse(response(complete))).resolves.toBeUndefined();
    await expect(assertPurgeSchedulerResponse(response({
      ...complete, processed: 0, purgedCount: 0, skippedCount: 0, pages: 0,
    }))).resolves.toBeUndefined();
  });

  it.each([
    ['full first page followed by empty fetch', { ...complete, processed: 25, purgedCount: 24, skippedCount: 1, pages: 1 }],
    ['two-page exact boundary after empty fetch', { ...complete, processed: 50, purgedCount: 49, skippedCount: 1, pages: 2 }],
    ['three-page partial final page', { ...complete, processed: 51, purgedCount: 50, skippedCount: 1, pages: 3 }],
    ['four-page partial final page', { ...complete, processed: 99, purgedCount: 98, skippedCount: 1, pages: 4 }],
  ])('accepts only scan-reachable complete page extents: %s', async (_label, receipt) => {
    await expect(assertPurgeSchedulerResponse(response(receipt))).resolves.toBeUndefined();
  });

  it.each([
    ['HTTP 202 Accepted', response(complete, 202)],
    ['HTTP 204 No Content', new Response(null, { status: 204 })],
    ['HTTP 206 Partial Content', response(complete, 206)],
    ['HTTP 503 retryable', response(complete, 503)],
    ['HTTP 200 non-JSON', new Response('success', { status: 200, headers: { 'content-type': 'text/plain' } })],
    ['HTTP 200 empty', new Response(null, { status: 200, headers: { 'content-type': 'application/json' } })],
    ['HTTP 200 malformed JSON', new Response('{oops', { status: 200, headers: { 'content-type': 'application/json' } })],
    ['HTTP 200 HTML content', new Response('<html>OK</html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['HTTP 200 oversized body', new Response('x'.repeat(2049), { status: 200, headers: { 'content-type': 'application/json' } })],
    ['HTTP 200 incorrect content-length', new Response('x'.repeat(2100), { status: 200, headers: { 'content-type': 'application/json', 'content-length': '10' } })],
  ])('rejects %s instead of acknowledging unverified erasure', async (_description, http) => {
    await expect(assertPurgeSchedulerResponse(http)).rejects.toThrow();
  });

  it.each([
    ['false success', { ...complete, ok: false }],
    ['status-incomplete', { ...complete, hasMore: true }],
    ['missing final marker', (({ hasMore: _unused, ...rest }) => rest)(complete)],
    ['incomplete prior sweep', { ...complete, unresolvedEarlierPages: true }],
    ['missing prior failure marker', (({ unresolvedEarlierPages: _unused, ...rest }) => rest)(complete)],
    ['failed deletion', { ...complete, failedCount: 1 }],
    ['nonzero failure string', { ...complete, failedCount: '0' }],
    ['negative failure count', { ...complete, failedCount: -1 }],
    ['processed count mismatch', { ...complete, processed: 4 }],
    ['skipped count overflow', { ...complete, skippedCount: 2 }],
    ['fractional processed count', { ...complete, processed: 3.5 }],
    ['fractional page count', { ...complete, pages: 0.5 }],
    ['nonempty receipt with zero pages', { ...complete, pages: 0 }],
    ['empty receipt with one page', { ...complete, processed: 0, purgedCount: 0, skippedCount: 0, pages: 1 }],
    ['two pages but fewer than 26 rows', { ...complete, processed: 25, purgedCount: 24, skippedCount: 1, pages: 2 }],
    ['two pages but more than 50 rows', { ...complete, processed: 51, purgedCount: 50, skippedCount: 1, pages: 2 }],
    ['three pages without two full preceding pages', { ...complete, processed: 26, purgedCount: 25, skippedCount: 1, pages: 3 }],
    ['four full pages falsely marked complete', { ...complete, processed: 100, purgedCount: 99, skippedCount: 1, pages: 4 }],
    ['page count exceeds scanner cap', { ...complete, pages: 5 }],
    ['processed count exceeds scanner cap', { ...complete, processed: 101, purgedCount: 100, skippedCount: 1 }],
    ['empty receipt', {}],
    ['false JSON scalar', 'OK'],
    ['JSON array', [complete]],
    ['null response', null],
  ])('rejects a fake or inconsistent HTTP 200 summary: %s', async (_label, payload) => {
    await expect(assertPurgeSchedulerResponse(response(payload))).rejects.toThrow();
  });

  it('type guard rejects malformed response object without fetch or read', () => {
    expect(() => assertCompletedVerificationPurge({ ...complete, hasMore: false })).not.toThrow();
    expect(() => assertCompletedVerificationPurge({ ...complete, failedCount: true })).toThrow();
  });
});
