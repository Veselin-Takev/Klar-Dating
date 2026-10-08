// @vitest-environment node
import { createHmac, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { eraseDiditPage } from '../src/server/accountDeletion';
import { validJobSignature } from '../src/server/complianceJobs';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('provider erasure and scheduled-job authentication', () => {
  it('deletes only exactly bound sessions and then deletes the provider user', async () => {
    const sessionId = randomUUID();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ session_id: sessionId, vendor_data: 'account' }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ deleted: 1 }));

    expect(await eraseDiditPage('account', 'ticket', 'key', fetcher as typeof fetch)).toBe(false);
    const sessionDelete = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(sessionDelete[1]).toMatchObject({ method: 'DELETE' });
    expect(sessionDelete[1]).not.toHaveProperty('body');

    expect(await eraseDiditPage('account', 'ticket', 'key', fetcher as typeof fetch)).toBe(true);
    const userDelete = fetcher.mock.calls[3] as unknown as [string, RequestInit];
    expect(JSON.parse(userDelete[1].body as string)).toEqual({ vendor_data_list: ['account'] });
  });

  it('never accepts another user or a provider outage as deletion success', async () => {
    const wrong = vi.fn(async () => jsonResponse({ results: [{ session_id: randomUUID(), vendor_data: 'other-account' }] }));
    await expect(eraseDiditPage('account', 'ticket', 'key', wrong as typeof fetch)).rejects.toThrow();
    expect(wrong).toHaveBeenCalledTimes(1);

    const listingOutage = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(eraseDiditPage('account', 'ticket', 'key', listingOutage as typeof fetch)).rejects.toThrow('didit_erasure_unavailable');

    const deleteOutage = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ session_id: randomUUID(), vendor_data: 'account' }] }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(eraseDiditPage('account', 'ticket', 'key', deleteOutage as typeof fetch)).rejects.toThrow('didit_erasure_unavailable');
  });

  it('rejects forged, old and tampered scheduler requests', () => {
    const now = Date.now();
    const body = Buffer.from(JSON.stringify({ timestamp: now }));
    const secret = 'scheduler-test-secret-of-at-least-32-characters';
    const sign = createHmac('sha256', secret).update(body).digest('hex');
    expect(validJobSignature(body, sign, secret, now)).toBe(true);
    expect(validJobSignature(body, sign, secret, now + 301_000)).toBe(false);
    expect(validJobSignature(Buffer.from('{}'), sign, secret, now)).toBe(false);
    expect(validJobSignature(body, '00'.repeat(32), secret, now)).toBe(false);
    expect(validJobSignature(body, sign, '', now)).toBe(false);
  });
});
