import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8');
const start = source.indexOf('export async function monitoredFetch(');
const end = source.indexOf('export async function askAIList(', start);
assert(start > 0 && end > start, 'monitoredFetch source boundary missing');
const monitored = source.slice(start, end);

assert(!/\binput\.toString\(\)/.test(monitored), 'Raw fetch URL in monitoring');
assert(!/\bconsole\.debug\([^)]*\binput\b/.test(monitored), 'Raw request in latency logs');
assert(monitored.includes("melde('http_request_failed', new Error('Network request failed'))"),
  'Caught network errors must be reported with a fixed, sanitized error');
assert(!/melde\([^;]*,\s*error\s*\)/.test(monitored),
  'Caught error may include a bearer token and must not reach Sentry');
const event = source.slice(source.indexOf("new CustomEvent('klar_api_error'"), source.indexOf("new CustomEvent('klar_api_error'") + 420);
assert(event.includes("detail: { message: 'Netzwerkfehler', url: '[redacted]' }"),
  'Global error event must not expose URL or raw error message');
assert(!event.includes('resource.toString()') && !event.includes('error.message'),
  'Error detail contains private URL or exception text');
console.log('PASS client fetch diagnostic privacy: no bearer URLs in telemetry or global events (source-only).');
