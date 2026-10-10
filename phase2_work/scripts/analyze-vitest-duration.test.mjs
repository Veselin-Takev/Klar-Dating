import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVitestReport } from './analyze-vitest-duration.mjs';

const input = { testResults: [
  { name: 'fast.spec.ts', status: 'passed', perfStats: { start: 1000, end: 1010 }, assertionResults: [{}] },
  { name: 'slow.spec.ts', status: 'failed', perfStats: { start: 2000, end: 2500 }, assertionResults: [{}, {}], secret: 'discard' },
] };

test('sort suites by duration without leaking unrelated fields', () => {
  const r = analyzeVitestReport(input);
  assert.equal(r.suiteCount, 2);
  assert.equal(r.totalSuiteDurationMs, 510);
  assert.equal(r.slowest[0].suite, 'slow.spec.ts');
  assert.equal(r.slowest[0].tests, 2);
  assert.equal(JSON.stringify(r).includes('discard'), false);
});
test('reject missing or invalid duration fields', () => {
  assert.throws(() => analyzeVitestReport({ testResults: [] }), /non-empty/);
  assert.throws(() => analyzeVitestReport({ testResults: [{ name: 'bad', perfStats: { start: 8, end: 7 } }] }), /invalid/);
});
test('accept top-level times when perfStats are absent', () => {
  assert.equal(analyzeVitestReport({ testResults: [{ name: 'sample', startTime: 10, endTime: 20 }] }).slowest[0].durationMs, 10);
});

test('handles official Jest-compatible Vitest JSON reporter shape', () => {
  const payload = {
    success: false,
    numTotalTests: 1,
    testResults: [{
      name: '/private/workspace/tests/security.spec.ts',
      startTime: 1697737019787,
      endTime: 1697737019797,
      status: 'failed',
      message: 'sensitive test failure contents',
      assertionResults: [{ status: 'failed', duration: 9, failureMessages: ['private assertion'] }],
    }],
  };
  const result = analyzeVitestReport(payload);
  assert.equal(result.slowest[0].durationMs, 10);
  assert.equal(result.slowest[0].status, 'failed');
  assert.equal(result.slowest[0].tests, 1);
  assert.equal(JSON.stringify(result).includes('sensitive test failure'), false);
  assert.equal(JSON.stringify(result).includes('private assertion'), false);
});
