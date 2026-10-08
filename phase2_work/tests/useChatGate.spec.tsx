import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChatGate } from '../src/lib/useChatGate';

vi.mock('../src/lib/firebase', () => ({ auth: { currentUser: { uid: 'alice' } } }));
const open = { zustand: 'offen', meine: 2, benoetigt: 2, fragen: null };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('chat gate boundary', () => {
  it.each([403, 404, 503])('keeps chat closed after status %s and permits an explicit retry', async status => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({}, status)).mockResolvedValueOnce(response(open));
    vi.stubGlobal('fetch', fetcher);
    const hook = renderHook(() => useChatGate('chat-one', 'alice'));
    await waitFor(() => expect(hook.result.current.status).toBe('fehler'));
    expect(hook.result.current.data).toBeNull();
    act(() => hook.result.current.refresh());
    await waitFor(() => expect(hook.result.current.status).toBe('offen'));
  });

  it('rejects incomplete success payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ zustand: 'offen' })));
    const hook = renderHook(() => useChatGate('chat-one', 'alice'));
    await waitFor(() => expect(hook.result.current.status).toBe('fehler'));
  });

  it('never carries an open gate into another conversation or accepts a late response', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(open))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response({ zustand: 'du_bist_dran', meine: 0, benoetigt: 2 })));
    const hook = renderHook(({ chat }) => useChatGate(chat, 'alice'), { initialProps: { chat: 'first' } });
    await waitFor(() => expect(hook.result.current.status).toBe('offen'));
    hook.rerender({ chat: 'second' });
    expect(hook.result.current.status).toBe('lade');
    hook.rerender({ chat: 'third' });
    await waitFor(() => expect(hook.result.current.status).toBe('du_bist_dran'));
    await act(async () => { finish(response(open)); });
    expect(hook.result.current.status).toBe('du_bist_dran');
  });

  it('never opens without an authenticated account or chat identifier', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const hook = renderHook(() => useChatGate(undefined, undefined));
    await waitFor(() => expect(hook.result.current.status).toBe('fehler'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
