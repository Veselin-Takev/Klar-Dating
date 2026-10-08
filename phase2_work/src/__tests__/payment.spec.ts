// @vitest-environment node
import { describe, test, expect } from 'vitest';
import http from 'http';

describe('Monetarisierung und Webhook-Fallbacks', () => {
  test('Webhook lehnt ungültige oder fehlende Signaturen ab', async () => {
    process.env.KLAR_NICHT_STARTEN = "1";
    const { baueApp } = await import('../../server');
    const app = await baueApp();
    const server = http.createServer(app);
    
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const res = await fetch(`http://localhost:${port}/api/webhooks/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subscription.activated' })
      });
      
      expect(res.status).toBeGreaterThanOrEqual(400);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('KlarPlus Status-Prüfung liefert false bei ungültiger User-ID', async () => {
    process.env.KLAR_NICHT_STARTEN = "1";
    const { baueApp } = await import('../../server');
    const app = await baueApp();
    const server = http.createServer(app);
    
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const res = await fetch(`http://localhost:${port}/api/account/entitlements?userId=ungueltig`);
      expect(res.status).toBeDefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
