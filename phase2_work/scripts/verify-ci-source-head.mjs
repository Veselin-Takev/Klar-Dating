import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateSourceHead(actual, expected) {
  assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'Missing or invalid expected source SHA');
  assert.match(actual ?? '', /^[a-f0-9]{40}$/, 'Missing or invalid checked-out SHA');
  assert.equal(actual, expected, 'CI source HEAD mismatch: refusing to validate a different tree');
  return actual;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const actual = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', timeout: 10_000 }).trim();
  console.log('Verified exact source checkout: ' + validateSourceHead(actual, process.env.CI_EXPECTED_SHA));
}
