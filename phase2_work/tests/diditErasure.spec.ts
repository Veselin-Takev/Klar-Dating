import { describe, expect, it, vi } from 'vitest';
import { eraseDiditPage } from '../src/server/accountDeletion';

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  });
}

describe('Didit account erasure', () => {
  it('accepts 204 session deletion and deletes the provider user only after sessions are gone', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { results: [{ session_id: '11111111-1111-4111-8111-111111111111', vendor_data: 'uid-1' }] }))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, { results: [] }))
      .mockResolvedValueOnce(response(200, { deleted: 1 }));
    expect(await eraseDiditPage('uid-1', 'request-1', 'api-key', fetcher as typeof fetch)).toBe(false);
    expect(await eraseDiditPage('uid-1', 'request-1', 'api-key', fetcher as typeof fetch)).toBe(true);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(fetcher.mock.calls[1]?.[1]).not.toHaveProperty('body');
  });

  it('charges a stale page containing only missing sessions to the retry budget', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { results: [{ session_id: '22222222-2222-4222-8222-222222222222', vendor_data: 'uid-2' }] }))
      .mockResolvedValueOnce(response(404));
    await expect(eraseDiditPage('uid-2', 'request-2', 'api-key', fetcher as typeof fetch)).rejects.toThrow('didit_erasure_no_progress');
  });

  it('fails closed on unexpected provider status', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { results: [{ session_id: '33333333-3333-4333-8333-333333333333', vendor_data: 'uid-3' }] }))
      .mockResolvedValueOnce(response(200, { unexpected: true }));
    await expect(eraseDiditPage('uid-3', 'request-3', 'api-key', fetcher as typeof fetch)).rejects.toThrow('didit_erasure_unavailable');
  });
});

