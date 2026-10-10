import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../functions/src/complianceJobs.ts', import.meta.url), 'utf8');

test('compliance queue retry never silently succeeds without a configured API origin', () => {
  assert.doesNotMatch(source, /if\s*\(!value\)\s*return\s*;/);
  assert.match(source, /if\s*\(!value\)\s*throw new Error\('COMPLIANCE_API_ORIGIN is required/);
});

test('compliance retry has a bounded request and fails on HTTP errors', () => {
  assert.match(source, /AbortSignal\.timeout\(150_000\)/);
  assert.match(source, /if \(!response\.ok\) throw new Error\('Compliance worker unavailable'\)/);
});
