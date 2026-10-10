import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/lib/AuthContext.tsx', import.meta.url), 'utf8');

function between(start, end) {
  const first = queue.indexOf(start);
  assert.notEqual(first, -1, 'Missing legacy queue function: ' + start);
  const last = queue.indexOf(end, first + start.length);
  assert.notEqual(last, -1, 'Missing following legacy queue function: ' + end);
  return queue.slice(first, last);
}

test('duplicate message IDs are isolated by owner and queue capacity is bounded', () => {
  const source = between('export async function enqueueChatMessage(', 'export async function getQueuedActions(');
  assert.match(source, /requireLegacyQueueOwner\(uid\)/);
  assert.match(source, /item\.payload\.uid === uid && item\.payload\.clientMessageId === clientMessageId/);
  assert.match(source, /memoryQueue\.filter\(item => item\.payload\.uid === uid\)\.length >= MAX_ITEMS_PER_USER/);
});

test('in-memory read APIs always require a queue owner', () => {
  const read = between('export async function getQueuedActions(', 'export async function syncQueuedActions(');
  assert.match(read, /getQueuedActions\(ownerUid: string\)/);
  assert.match(read, /getQueuedMessagesForChat\(chatId: string, ownerUid: string\)/);
  assert.equal((read.match(/requireLegacyQueueOwner\(ownerUid\)/g) ?? []).length, 2);
  assert.match(read, /item\.payload\.uid === ownerUid/);
});

test('legacy replay requires owner and bearer token before network requests', () => {
  const source = between('export async function syncQueuedActions(', 'export async function enqueueOfflineMessage(');
  assert.match(source, /ownerUid: string/);
  assert.match(source, /authToken: string/);
  assert.match(source, /requireLegacyQueueOwner\(options\.ownerUid\)/);
  assert.match(source, /throw new Error\('legacy_queue_auth_required'\)/);
  assert.match(source, /memoryQueue\.filter\(item => item\.payload\.uid === options\.ownerUid\)/);
  assert.match(source, /Authorization: `Bearer \$\{options\.authToken\}`/);
});

test('logout clears both queues, and legacy logs are owner-scoped', () => {
  assert.match(auth, /import \{ clearQueueForUser \} from '\.\/offlineQueue'/);
  assert.match(auth, /await clearQueueForUser\(uid\)/);
  assert.match(queue, /memorySyncLogs = memorySyncLogs\.filter\(entry => entry\.ownerUid !== ownerUid\)/);
  const log = queue.slice(queue.indexOf('export function getSyncLogs('));
  assert.match(log, /getSyncLogs\(ownerUid: string\)/);
  assert.match(log, /entry\.ownerUid === ownerUid/);
});
