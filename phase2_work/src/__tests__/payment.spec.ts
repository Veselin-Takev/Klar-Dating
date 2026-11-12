// @vitest-environment node
import { describe, test, expect } from 'vitest';

// The test:ci harness owns the real API process and emulator lifecycle.
// Do not import baueApp here: that creates competing Vite/HMR servers.
// Localhost is the loopback-only CI API, never a remote payment endpoint.
const base = 'http://localhost:3000';
describe('payment API authentication and signature boundary', () => {
  test('rejects a Stripe webhook without a valid signature', async () => {
    const response = await fetch(base + '/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'customer.subscription.updated' }),
      signal: AbortSignal.timeout(3000),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid webhook' });
  });
  test('does not resolve subscriptions from a caller-supplied user ID without authentication', async () => {
    const response = await fetch(
      base + '/api/subscription/status?userId=foreign-user',
      { signal: AbortSignal.timeout(3000) },
    );
    expect(response.status).toBe(401);
  });
});
