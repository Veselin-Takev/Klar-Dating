// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createBillingRouter } from '../src/server/routes/billing';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

async function endpoint(options: {
  uid?: string | null;
  bookable?: boolean;
  validateReturnUrl?: (url: string) => string;
  createCheckoutSession?: (uid: string, url: string) => Promise<string | null>;
} = {}) {
  const checkout = vi.fn(options.createCheckoutSession ?? (async () => 'https://checkout.example/session'));
  const validate = vi.fn(options.validateReturnUrl ?? ((url: string) => url));
  const app = express();
  app.use(express.json());
  app.use('/api', createBillingRouter({
    currentUserId: () => options.uid === undefined ? 'user-a' : options.uid,
    isBookable: () => options.bookable ?? false,
    validateReturnUrl: validate,
    createCheckoutSession: checkout,
    getFirestore: () => ({
      collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }) }),
      runTransaction: async (fn: any) => fn({ get: async () => ({ exists: false, data: () => undefined }), set: () => {}, update: () => {} })
    } as any),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/subscribe-klar-plus';
  return { checkout, validate, send: (body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) };
}

const payload = { userId: 'user-a', returnUrl: 'https://klar.app/profile' };

describe('Klar+ checkout HTTP boundary', () => {
  it('enforces the server-side product gate and never calls Stripe while Klar+ is not bookable', async () => {
    const api = await endpoint({ bookable: false });
    const response = await api.send(payload);
    expect(response.status).toBe(501);
    expect((await response.json()).code).toBe('klar_plus_not_bookable');
    expect(api.validate).not.toHaveBeenCalled();
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests', async () => {
    const api = await endpoint({ uid: null, bookable: true });
    const response = await api.send(payload);
    expect(response.status).toBe(401);
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it('rejects cross-user checkout attempts when booking is enabled', async () => {
    const api = await endpoint({ uid: 'user-a', bookable: true });
    const response = await api.send({ ...payload, userId: 'user-b' });
    expect(response.status).toBe(403);
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it('rejects invalid or non-allowlisted return URLs before calling Stripe', async () => {
    const api = await endpoint({ bookable: true, validateReturnUrl: () => { throw new Error('origin is not allowed'); } });
    const response = await api.send(payload);
    expect(response.status).toBe(400);
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it('creates checkout only for an authenticated user with a validated return URL', async () => {
    const safe = 'https://klar.app/profile';
    const api = await endpoint({ bookable: true, validateReturnUrl: () => safe });
    const response = await api.send(payload);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://checkout.example/session' });
    expect(api.checkout).toHaveBeenCalledWith('user-a', safe);
  });
  it('fails closed when the payment provider is unavailable and hides provider details', async () => {
    const api = await endpoint({ bookable: true, createCheckoutSession: async () => { throw new Error('private Stripe detail'); } });
    const response = await api.send(payload);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private Stripe detail');
  });
});
