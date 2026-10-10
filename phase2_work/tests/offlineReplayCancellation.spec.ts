import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { flushOfflineQueue } from '../src/lib/offlineQueue';
const mocks = vi.hoisted(() => ({ readOwner: vi.fn() }));

vi.mock('../src/lib/userScopedStorage', () => ({
  klarStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  getUserStorageItem: () => null,
  setUserStorageItem: () => undefined,
  removeUserStorageItem: () => undefined,
}));
vi.mock('../src/lib/offlineQueueIndexedReads', () => ({
  queueItemsForOwner: mocks.readOwner,
  queueItemById: vi.fn(),
}));

const queued = () => ({
  id: 'message:alice:one',
  ownerUid: 'alice',
  url: '/api/messages/send' as const,
  method: 'POST' as const,
  payload: { chatId: 'chat-1', text: 'private', clientMessageId: 'one' },
  queuedAt: 100,
  attempts: 0,
  nextAttemptAt: 0,
  status: 'pending' as const,
});

beforeEach(() => {
  const fakeDb = { close: vi.fn() };
  vi.stubGlobal('indexedDB', {
    open: () => {
      const request: { result: typeof fakeDb; onsuccess?: () => void } = { result: fakeDb };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  mocks.readOwner.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline replay authentication transition', () => {
  it('does not open IndexedDB or send if already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    const result = await flushOfflineQueue({
      ownerUid: 'alice', token: 'token', signal: controller.signal,
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0, deadLettered: 0 });
    expect(mocks.readOwner).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('stops before network replay when the active account changed', async () => {
    mocks.readOwner.mockResolvedValue([queued()]);
    let active = true;
    const fetcher: typeof fetch = async () => {
      throw new Error('network must not be used');
    };
    mocks.readOwner.mockImplementation(async () => {
      active = false;
      return [queued()];
    });
    const result = await flushOfflineQueue({
      ownerUid: 'alice', token: 'token', fetcher, isCurrentUser: () => active,
    });
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 1, deadLettered: 0 });
  });

  it('does not acknowledge, delete or retry a message after user switch while waiting for HTTP', async () => {
    const message = queued();
    mocks.readOwner.mockResolvedValue([message]);
    let active = true;
    const fetcher: typeof fetch = async () => {
      active = false;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    };
    const result = await flushOfflineQueue({
      ownerUid: 'alice', token: 'token', fetcher,
      isCurrentUser: () => active,
    });
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 1, deadLettered: 0 });
    expect(message.attempts).toBe(0);
    expect(message.status).toBe('pending');
  });

  it('cancellation during a failing fetch does not increase retries or dead-letter the action', async () => {
    const message = queued();
    mocks.readOwner.mockResolvedValue([message]);
    const controller = new AbortController();
    const fetcher: typeof fetch = async () => {
      controller.abort();
      throw new Error('AbortError');
    };
    const result = await flushOfflineQueue({
      ownerUid: 'alice', token: 'token', signal: controller.signal, fetcher,
    });
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 1, deadLettered: 0 });
    expect(message.attempts).toBe(0);
  });
});
