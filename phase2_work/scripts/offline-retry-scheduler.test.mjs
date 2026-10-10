import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const banner = readFileSync(new URL('../src/components/SyncBanner.tsx', import.meta.url), 'utf8');
const queue = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');

function block(start, end) {
  const from = banner.indexOf(start);
  assert.ok(from >= 0, 'missing block: ' + start);
  const to = banner.indexOf(end, from + start.length);
  assert.ok(to > from, 'missing block end: ' + end);
  return banner.slice(from, to);
}

test('retry timer is scheduled only while the same user is online and has pending writes', () => {
  assert.match(banner, /if \(result\.remaining > 0 && navigator\.onLine\)/);
  assert.match(banner, /retryTimer = setTimeout\(\(\) => \{/);
  assert.match(banner, /if \(isCurrent\(\)\) void syncForUser\(auth\.currentUser\)/);
  assert.match(banner, /\}, 60_000\)/);
  assert.match(queue, /return Math\.min\(60_000, 2_000 \* 2 \*\* Math\.max\(0, attempts - 1\)\)/);
});

test('only one timer is active and it is canceled by online/offline/auth transitions', () => {
  assert.match(banner, /let retryTimer: ReturnType<typeof setTimeout> \| null = null/);
  assert.match(banner, /if \(retryTimer !== null\) clearTimeout\(retryTimer\)/);
  for (const [start, end] of [
    ['const handleOnline = () => {', 'const handleOffline = () => {'],
    ['const handleOffline = () => {', 'const cancelReplay = () => {'],
    ['const cancelReplay = () => {', 'const unsubscribeAuth = onAuthStateChanged'],
  ]) {
    assert.match(block(start, end), /cancelRetry\(\)/);
  }
  assert.match(block('if (!user) {', '// The auth listener initiates'), /cancelRetry\(\)/);
  assert.match(block('return () => {', '\n  }, []);'), /cancelRetry\(\)/);
});

test('logout cancels even if online connection has not changed', () => {
  assert.match(banner, /window\.addEventListener\(OFFLINE_REPLAY_CANCEL_EVENT, cancelReplay\)/);
  assert.match(banner, /pausedUid = auth\.currentUser\?\.uid \?\? null/);
  assert.match(banner, /if \(!user \|\| disposed \|\| pausedUid === user\.uid\) return/);
  assert.match(banner, /window\.removeEventListener\(OFFLINE_REPLAY_CANCEL_EVENT, cancelReplay\)/);
});
