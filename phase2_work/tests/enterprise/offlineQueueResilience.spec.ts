import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQueuedActions,
  clearQueueForUser,
  enqueueChatMessage,
  getQueuedMessagesForChat,
  syncQueuedActions,
  getSyncLogs,
  clearSyncLogs,
} from '../../src/lib/offlineQueue.ts';

const TEST_OWNERS = ['user-alice', 'user-1', 'user-sync', 'user-bob'];

test.beforeEach(async () => {
  await Promise.all(TEST_OWNERS.map((uid) => clearQueueForUser(uid)));
  await clearSyncLogs();
});

test('enqueueChatMessage enqueues a new message with pending status and clientMessageId', async () => {
  const action = await enqueueChatMessage(
    'chat-offline-101',
    'Hallo! Ich bin gerade in der U-Bahn ohne Empfang.',
    'client-msg-uuid-001',
    'user-alice'
  );

  assert.equal(action.type, 'SEND_MESSAGE');
  assert.equal(action.status, 'pending');
  assert.equal(action.payload.chatId, 'chat-offline-101');
  assert.equal(action.payload.text, 'Hallo! Ich bin gerade in der U-Bahn ohne Empfang.');
  assert.equal(action.payload.clientMessageId, 'client-msg-uuid-001');
  assert.equal(action.payload.uid, 'user-alice');
  assert.ok(action.timestamp > 0);

  const queued = await getQueuedActions('user-alice');
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.payload.clientMessageId, 'client-msg-uuid-001');
});

test('enqueueChatMessage deduplicates rapid repeated submits with identical clientMessageId', async () => {
  const first = await enqueueChatMessage(
    'chat-offline-102',
    'Gleiche Nachricht zweimal geklickt',
    'client-msg-uuid-dup',
    'user-alice'
  );

  const second = await enqueueChatMessage(
    'chat-offline-102',
    'Gleiche Nachricht zweimal geklickt',
    'client-msg-uuid-dup',
    'user-alice'
  );

  assert.equal(first.id, second.id);
  const queued = await getQueuedActions('user-alice');
  assert.equal(queued.length, 1);
});

test('getQueuedMessagesForChat retrieves only messages for target chat', async () => {
  await enqueueChatMessage('chat-A', 'Nachricht an A', 'uuid-a1', 'user-1');
  await enqueueChatMessage('chat-B', 'Nachricht an B', 'uuid-b1', 'user-1');
  await enqueueChatMessage('chat-A', 'Zweite Nachricht an A', 'uuid-a2', 'user-1');

  const forA = await getQueuedMessagesForChat('chat-A', 'user-1');
  assert.equal(forA.length, 2);
  assert.equal(forA[0]!.payload.text, 'Nachricht an A');
  assert.equal(forA[1]!.payload.text, 'Zweite Nachricht an A');

  const forB = await getQueuedMessagesForChat('chat-B', 'user-1');
  assert.equal(forB.length, 1);
  assert.equal(forB[0]!.payload.text, 'Nachricht an B');
});

test('syncQueuedActions successfully sends messages, logs latency and clears queue', async () => {
  await enqueueChatMessage('chat-sync-1', 'Synchronisiere mich!', 'uuid-sync-1', 'user-sync');

  const mockFetch: typeof fetch = async (url, options) => {
    assert.equal(url, '/api/messages/send');
    const parsed = JSON.parse(options?.body as string);
    assert.equal(parsed.chatId, 'chat-sync-1');
    assert.equal(parsed.text, 'Synchronisiere mich!');
    assert.equal(parsed.clientMessageId, 'uuid-sync-1');

    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'srv-msg-999' }),
    } as unknown as Response;
  };

  const result = await syncQueuedActions({
    ownerUid: 'user-sync',
    authToken: 'valid-test-token',
    fetchFn: mockFetch,
  });

  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);

  const remaining = await getQueuedActions('user-sync');
  assert.equal(remaining.length, 0);

  const logs = await getSyncLogs('user-sync');
  assert.equal(logs.length, 1);
  assert.equal(logs[0]!.type, 'SEND_MESSAGE');
  assert.equal(logs[0]!.status, 'success');
  assert.ok(logs[0]!.latencyMs !== undefined && logs[0]!.latencyMs >= 0);
});

test('syncQueuedActions retries on 500 error and increments retryCount', async () => {
  await enqueueChatMessage('chat-retry', 'Server hat Schluckauf', 'uuid-err-1', 'user-sync');

  let callCount = 0;
  const mockFailingFetch: typeof fetch = async () => {
    callCount++;
    return {
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service Unavailable' }),
    } as unknown as Response;
  };

  const result = await syncQueuedActions({
    ownerUid: 'user-sync',
    authToken: 'valid-test-token',
    fetchFn: mockFailingFetch,
  });

  assert.equal(callCount, 1);
  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 1);

  const queued = await getQueuedActions('user-sync');
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.status, 'failed');
  assert.equal(queued[0]!.retryCount, 1);
  assert.equal(queued[0]!.lastError, 'Service Unavailable');
});

test('syncQueuedActions dead-letters irrecoverable 400 client error without blocking subsequent messages', async () => {
  // First message will fail with 400
  await enqueueChatMessage('chat-corrupt', 'Defekt', 'uuid-bad', 'user-sync');
  // Second message is healthy
  await enqueueChatMessage('chat-healthy', 'Gesund', 'uuid-good', 'user-sync');

  const mockSelectiveFetch: typeof fetch = async (_url, options) => {
    const parsed = JSON.parse(options?.body as string);
    if (parsed.chatId === 'chat-corrupt') {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'Chat session closed' }),
      } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'srv-good-1' }),
    } as unknown as Response;
  };

  const result = await syncQueuedActions({
    ownerUid: 'user-sync',
    authToken: 'valid-test-token',
    fetchFn: mockSelectiveFetch,
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);

  const queued = await getQueuedActions('user-sync');
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.status, 'dead_letter');
  assert.equal(queued[0]!.payload.chatId, 'chat-corrupt');

  // getQueuedMessagesForChat should ignore dead_letter
  const activeForCorrupt = await getQueuedMessagesForChat('chat-corrupt', 'user-sync');
  assert.equal(activeForCorrupt.length, 0);
});


test('same message id on separate accounts must not deduplicate or reveal the other owner', async () => {
  const alice = await enqueueChatMessage('chat-common', 'Alice private', 'same-message-id', 'user-alice');
  const bob = await enqueueChatMessage('chat-common', 'Bob private', 'same-message-id', 'user-bob');
  assert.notEqual(alice.id, bob.id);
  assert.equal((await getQueuedActions('user-alice')).length, 1);
  assert.equal((await getQueuedActions('user-bob')).length, 1);
  assert.equal((await getQueuedMessagesForChat('chat-common', 'user-alice'))[0]?.payload.text, 'Alice private');
  assert.equal((await getQueuedMessagesForChat('chat-common', 'user-bob'))[0]?.payload.text, 'Bob private');
});

test('legacy send processes only its authenticated owner and never another queued user', async () => {
  await enqueueChatMessage('chat-common', 'Alice private', 'alice-only', 'user-alice');
  await enqueueChatMessage('chat-common', 'Bob private', 'bob-only', 'user-bob');
  const sent = [];
  const fetchFn = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    assert.equal(options.headers.Authorization, 'Bearer alice-token');
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
  const result = await syncQueuedActions({ ownerUid: 'user-alice', authToken: 'alice-token', fetchFn });
  assert.deepEqual([result.total, result.succeeded, result.failed], [1, 1, 0]);
  assert.deepEqual(sent.map(item => item.uid), ['user-alice']);
  assert.equal((await getQueuedActions('user-bob')).length, 1);
});

test('legacy reads and sending reject missing owner or auth token', async () => {
  await enqueueChatMessage('chat-test', 'private text', 'secure-id', 'user-alice');
  await assert.rejects(getQueuedActions(''), /owner/i);
  await assert.rejects(getQueuedMessagesForChat('chat-test', ''), /owner/i);
  let called = 0;
  const fetchFn = async () => { called += 1; throw new Error('must not send'); };
  await assert.rejects(syncQueuedActions({ ownerUid: 'user-alice', authToken: '', fetchFn }), /auth/i);
  await assert.rejects(syncQueuedActions({ ownerUid: '', authToken: 'alice-token', fetchFn }), /owner/i);
  assert.equal(called, 0);
  assert.equal((await getQueuedActions('user-alice')).length, 1);
});

test('clearing one owner leaves the other owners queued messages untouched', async () => {
  await enqueueChatMessage('chat-common', 'Alice', 'alice-clear', 'user-alice');
  await enqueueChatMessage('chat-common', 'Bob', 'bob-keep', 'user-bob');
  await clearQueueForUser('user-alice');
  assert.deepEqual(await getQueuedActions('user-alice'), []);
  assert.equal((await getQueuedActions('user-bob')).length, 1);
});

test('legacy sync logs never expose entries owned by another user', async () => {
  await enqueueChatMessage('chat-alice', 'Alice only', 'log-alice', 'user-alice');
  await enqueueChatMessage('chat-bob', 'Bob only', 'log-bob', 'user-bob');
  const fetchFn = async () => ({ ok: false, status: 503, json: async () => ({ code: 'temporary_down' }) });
  await syncQueuedActions({ ownerUid: 'user-alice', authToken: 'alice-token', fetchFn });
  await syncQueuedActions({ ownerUid: 'user-bob', authToken: 'bob-token', fetchFn });
  const aliceLogs = getSyncLogs('user-alice');
  const bobLogs = getSyncLogs('user-bob');
  assert.equal(aliceLogs.length, 1);
  assert.equal(bobLogs.length, 1);
  assert.ok(aliceLogs.every(entry => entry.ownerUid === 'user-alice'));
  assert.ok(bobLogs.every(entry => entry.ownerUid === 'user-bob'));
  await clearQueueForUser('user-alice');
  assert.equal(getSyncLogs('user-alice').length, 0);
  assert.equal(getSyncLogs('user-bob').length, 1);
  assert.throws(() => getSyncLogs(''), /owner/i);
});
