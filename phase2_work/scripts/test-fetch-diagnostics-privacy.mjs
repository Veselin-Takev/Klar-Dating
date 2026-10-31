// Regression guard for issue #206: URLs must never flow into fetch diagnostics.
// This test uses only Node built-ins; it does not require Firebase credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/lib/api.ts', import.meta.url)), 'utf8');
const start = source.indexOf('export async function monitoredFetch(');
const end = source.indexOf('\nexport async function ', start + 10);
const wrapper = start >= 0 ? source.slice(start, end < 0 ? undefined : end) : '';

test('monitoredFetch exists and does not interpolate URL or request into diagnostics', () => {
  assert.ok(start >= 0, 'monitoredFetch must exist');
  assert.match(wrapper, /MONITORED_FETCH_LABEL/);
  assert.doesNotMatch(wrapper, /input\.toString\s*\(/);
  assert.doesNotMatch(wrapper, /input\.(?:url|href|search|pathname)/);
  assert.doesNotMatch(wrapper, /(?:console\.|melde\().*\binput\b/);
  assert.doesNotMatch(wrapper, /(?:console\.|melde\().*\berror\b[^)]*,\s*error\b/);
});

test('fetch diagnostic error is sanitized while caller receives original error', () => {
  assert.match(wrapper, /new Error\('Outbound fetch failed'\)/);
  assert.match(wrapper, /throw error;/);
  assert.doesNotMatch(wrapper, /melde\([^;]*,\s*error\s*\)/s);
});

test('metric labels cannot expose URL fragments, bearer tokens or query strings', () => {
  assert.match(source, /const MONITORED_FETCH_LABEL = 'outbound request';/);
  assert.doesNotMatch(wrapper, /(?:url:|query:|token:|requestUrl:)/i);
});
