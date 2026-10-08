// @vitest-environment node
import { afterEach, describe, it, expect, vi } from 'vitest';
import { validateReturnUrl, createCheckoutSession, getStripe } from './stripeService';
import type { Firestore } from 'firebase-admin/firestore';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const fakeDb = () => {
  const data = new Map<string, Record<string, unknown>>([['users/test-user', {}], ['subscriptions/test-user', {}]]);
  return {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (fn: any) => fn({
      getAll: async (...refs: any[]) => refs.map(ref => ({ data: () => data.get(ref.path) ?? {} })),
      get: async (ref: any) => ({ data: () => data.get(ref.path) ?? {} }),
      set: (ref: any, value: Record<string, unknown>) => data.set(ref.path, { ...(data.get(ref.path) ?? {}), ...value }),
    }),
  } as unknown as Firestore;
};

describe('checkout return URLs', () => {
  it('rejects credentials, insecure URLs and foreign origins', () => {
    for (const url of ['http://klar.app', 'https://evil.test', 'https://u:p@klar.app', 'https://klar.app.evil.test']) expect(() => validateReturnUrl(url)).toThrow();
    expect(validateReturnUrl('https://klar.app/account?tab=billing#plan')).toBe('https://klar.app/account?tab=billing#plan');
  });
  it('preserves existing query and fragment and sends the literal Stripe placeholder', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit');
    const create = vi.spyOn(getStripe().checkout.sessions, 'create').mockResolvedValue({ url: 'https://checkout.stripe.com/test' } as never);
    expect(await createCheckoutSession('test-user', 'https://klar.app/account?tab=billing#plan', fakeDb())).toBe('https://checkout.stripe.com/test');
    const args = create.mock.calls[0]?.[0];
    expect(args?.success_url).toBe('https://klar.app/account?tab=billing&session_id={CHECKOUT_SESSION_ID}#plan');
    expect(args?.cancel_url).toBe('https://klar.app/account?tab=billing&cancel=true#plan');
    expect(args?.client_reference_id).toBe('test-user');
  });
});
