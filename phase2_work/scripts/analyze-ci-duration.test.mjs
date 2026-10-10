import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeJobs } from './analyze-ci-duration.mjs';

test('orders steps by duration and includes conclusion', () => {
  const results = analyzeJobs({ jobs: [{ name: 'validate', steps: [
    { name: 'build', started_at: '2026-10-10T10:00:00Z', completed_at: '2026-10-10T10:00:05Z', conclusion: 'success' },
    { name: 'test', started_at: '2026-10-10T10:01:00Z', completed_at: '2026-10-10T10:01:20Z', conclusion: 'failure' },
  ] }] });
  assert.equal(results.totalStepSeconds, 25);
  assert.deepEqual(results.slowest.map(x => x.step), ['test', 'build']);
  assert.equal(results.slowest[0].status, 'failure');
});
test('rejects malformed payloads and inverted times', () => {
  assert.throws(() => analyzeJobs({ jobs: [] }), /non-empty/);
  assert.throws(() => analyzeJobs({ jobs: [{ steps: [{ name: 'bad', started_at: '2026-10-10T10:00:01Z', completed_at: '2026-10-10T10:00:00Z' }] }] }), /Invalid timestamps/);
});
test('does not include GitHub job environment, token or URLs in output', () => {
  const result = analyzeJobs([{ name: 'validate', secret: 'not-for-report', steps: [{ name: 'pass', started_at: '2026-10-10T10:00:00Z', completed_at: '2026-10-10T10:00:01Z', token: 'sensitive' }] }]);
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
  assert.equal(JSON.stringify(result).includes('not-for-report'), false);
});

test('rejects partial timestamps and empty measured runs', () => {
  assert.throws(() => analyzeJobs([{ name: 'validate', steps: [{ name: 'test', started_at: '2026-10-10T10:00:00Z' }] }]), /Incomplete step timestamps/);
  assert.throws(() => analyzeJobs([{ name: 'validate', steps: [{ name: 'test', conclusion: 'success' }] }]), /Missing step timestamps/);
  assert.throws(() => analyzeJobs([{ name: 'validate', steps: [{ name: 'skipped', conclusion: 'skipped' }] }]), /No completed steps/);
});
