import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQueueForUser,
  clearSyncLogs,
  enqueueChatMessage,
  getQueuedActions,
  getQueuedMessagesForChat,
  getSyncLogs,
  syncQueuedActions,
} from '../src/lib/offlineQueue';

const ALICE = 'legacy-a';
const BOB = 'legacy-b';

beforeEach(async () => {
  await clearQueueForUser(ALICE);
  await clearQueueForUser(BOB);
  clearSyncLogs();
});

describe('legacy offline message queue account isolation', () => {
  it('deduplicates per UID and leaves equal message IDs from another account intact', async () => {
    const alice = await enqueueChatMessage('shared-chat', 'Alice private', 'same-id', ALICE);
    const duplicate = await enqueueChatMessage('shared-chat', 'Alice private', 'same-id', ALICE);
    const bob = await enqueueChatMessage('shared-chat', 'Bob private', 'same-id', BOB);
    expect(duplicate.id).toBe(alice.id);
    expect(bob.id).not.toBe(alice.id);
    expect((await getQueuedActions(ALICE)).map(item => item.id)).toEqual([alice.id]);
    expect((await getQueuedActions(BOB)).map(item => item.id)).toEqual([bob.id]);
    expect((await getQueuedMessagesForChat('shared-chat', ALICE)).map(item => item.payload.text)).toEqual(['Alice private']);
    expect((await getQueuedMessagesForChat('shared-chat', BOB)).map(item => item.payload.text)).toEqual(['Bob private']);
  });

  it('sends only the requested account with a bearer token and preserves other pending actions', async () => {
    await enqueueChatMessage('shared-chat', 'Alice private', 'a1', ALICE);
    await enqueueChatMessage('shared-chat', 'Bob private', 'b1', BOB);
    const sent: Array<{ uid: string; text: string }> = [];
    const fetchFn: typeof fetch = async (_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer Alice-token');
      sent.push(JSON.parse(String(init?.body)) as { uid: string; text: string });
      return { ok: true, status: 200, json: async () => ({ success: true }) } as unknown as Response;
    };
    const result = await syncQueuedActions({ ownerUid: ALICE, authToken: 'Alice-token', fetchFn });
    expect(result).toEqual({ total: 1, succeeded: 1, failed: 0 });
    expect(sent.map(item => item.uid)).toEqual([ALICE]);
    expect((await getQueuedActions(BOB)).map(item => item.payload.text)).toEqual(['Bob private']);
  });

  it.each([
    ['empty JSON', {}],
    ['explicit rejection', { success: false }],
    ['truthy text', { success: 'true' }],
  ])('does not remove queued messages on a 200 response with %s', async (_description, responseBody) => {
    await enqueueChatMessage('private-chat', 'unsent', 'unconfirmed-id', ALICE);
    const fetchFn: typeof fetch = async () => ({
      ok: true, status: 200, json: async () => responseBody,
    } as unknown as Response);
    const result = await syncQueuedActions({ ownerUid: ALICE, authToken: 'valid-token', fetchFn });
    expect(result).toEqual({ total: 1, succeeded: 0, failed: 1 });
    const retained = await getQueuedActions(ALICE);
    expect(retained).toHaveLength(1);
    expect(retained[0]).toMatchObject({
      status: 'failed', retryCount: 1, lastError: 'message_acknowledgement_missing',
    });
    expect(getSyncLogs(ALICE).at(-1)?.status).toBe('failed');
  });

  it('rejects missing owner and token before calling the transport', async () => {
    await enqueueChatMessage('shared-chat', 'Alice', 'a2', ALICE);
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      throw new Error('Must not send');
    };
    await expect(getQueuedActions('')).rejects.toThrow('legacy_queue_owner_required');
    await expect(getQueuedMessagesForChat('shared-chat', '')).rejects.toThrow('legacy_queue_owner_required');
    await expect(syncQueuedActions({ ownerUid: '', authToken: 'token', fetchFn })).rejects.toThrow('legacy_queue_owner_required');
    await expect(syncQueuedActions({ ownerUid: ALICE, authToken: '', fetchFn })).rejects.toThrow('legacy_queue_auth_required');
    expect(calls).toBe(0);
  });

  it('isolates failure logs and clears only the selected account', async () => {
    await enqueueChatMessage('shared-chat', 'Alice', 'a3', ALICE);
    await enqueueChatMessage('shared-chat', 'Bob', 'b3', BOB);
    const fetchFn: typeof fetch = async () => ({
      ok: false, status: 503, json: async () => ({ code: 'temporary_down' }),
    } as unknown as Response);
    await syncQueuedActions({ ownerUid: ALICE, authToken: 'a-token', fetchFn });
    await syncQueuedActions({ ownerUid: BOB, authToken: 'b-token', fetchFn });
    expect(getSyncLogs(ALICE)).toHaveLength(1);
    expect(getSyncLogs(BOB)).toHaveLength(1);
    expect(getSyncLogs(ALICE).every(entry => entry.ownerUid === ALICE)).toBe(true);
    await clearQueueForUser(ALICE);
    expect(getSyncLogs(ALICE)).toHaveLength(0);
    expect(getSyncLogs(BOB)).toHaveLength(1);
    expect(await getQueuedActions(ALICE)).toHaveLength(0);
    expect(await getQueuedActions(BOB)).toHaveLength(1);
  });
});
