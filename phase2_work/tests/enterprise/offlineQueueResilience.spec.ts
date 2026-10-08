import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQueuedActions,
  clearQueue,
  enqueueChatMessage,
  getQueuedMessagesForChat,
  syncQueuedActions,
  getSyncLogs,
  clearSyncLogs,
} from '../../src/lib/offlineQueue.ts';

test.beforeEach(async () => {
  await clearQueue();
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

  const queued = await getQueuedActions();
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
  const queued = await getQueuedActions();
  assert.equal(queued.length, 1);
});

test('getQueuedMessagesForChat retrieves only messages for target chat', async () => {
  await enqueueChatMessage('chat-A', 'Nachricht an A', 'uuid-a1', 'user-1');
  await enqueueChatMessage('chat-B', 'Nachricht an B', 'uuid-b1', 'user-1');
  await enqueueChatMessage('chat-A', 'Zweite Nachricht an A', 'uuid-a2', 'user-1');

  const forA = await getQueuedMessagesForChat('chat-A');
  assert.equal(forA.length, 2);
  assert.equal(forA[0]!.payload.text, 'Nachricht an A');
  assert.equal(forA[1]!.payload.text, 'Zweite Nachricht an A');

  const forB = await getQueuedMessagesForChat('chat-B');
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
    authToken: 'valid-test-token',
    fetchFn: mockFetch,
  });

  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);

  const remaining = await getQueuedActions();
  assert.equal(remaining.length, 0);

  const logs = await getSyncLogs();
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
    authToken: 'valid-test-token',
    fetchFn: mockFailingFetch,
  });

  assert.equal(callCount, 1);
  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 1);

  const queued = await getQueuedActions();
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
    authToken: 'valid-test-token',
    fetchFn: mockSelectiveFetch,
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);

  const queued = await getQueuedActions();
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.status, 'dead_letter');
  assert.equal(queued[0]!.payload.chatId, 'chat-corrupt');

  // getQueuedMessagesForChat should ignore dead_letter
  const activeForCorrupt = await getQueuedMessagesForChat('chat-corrupt');
  assert.equal(activeForCorrupt.length, 0);
});
