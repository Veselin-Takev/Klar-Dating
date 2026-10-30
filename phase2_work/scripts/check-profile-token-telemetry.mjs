// Narrow, fail-closed regression for accidental capability-URL leakage.
// This does not solve long-lived Firebase download URLs in profile documents.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('src/lib/api.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const legacyHeaders = readFileSync('src/server/securityHeaders.ts', 'utf8');
const tests = readFileSync('tests/profileTokenTelemetryPrivacy.spec.ts', 'utf8');

const from = api.indexOf('export async function monitoredFetch(');
const to = api.indexOf('export async function askAIList(', from);
assert.ok(from >= 0 && to > from, 'legacy fetch wrapper source boundary missing');
const wrapper = api.slice(from, to);
assert.doesNotMatch(wrapper, /input\.toString\s*\(/, 'never log raw request URLs');
assert.doesNotMatch(wrapper, /melde\([^)]*\berror\b\s*\)/, 'never report raw provider errors');
assert.match(wrapper, /melde\('Fetch\/network', new Error\('Network request failed'\)\)/,
  'send generic diagnostics only');
assert.match(server, /referrerPolicy:\s*\{\s*policy:\s*'no-referrer'\s*\}/,
  'active Helmet middleware must enforce no-referrer');
assert.match(legacyHeaders, /Referrer-Policy", "no-referrer"/,
  'auxiliary header implementation must not weaken referrer policy');
assert.match(tests, /token-bearing requests preserve fetch semantics without logging URL or query/,
  'privacy regression suite must remain in CI');
console.log('Profile URL telemetry/referrer minimization: PASS (source only; download-token migration remains OPEN)');
