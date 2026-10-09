import { expect, test } from '@playwright/test';
import { authHeaders, completeAgeAndConsent, enterGuestPreview } from './identity-helpers';

test('Klar+ stays non-bookable and legacy A/B analytics stays disabled', async ({ page }) => {
  let legacyRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/analytics/ab-test') legacyRequests += 1;
  });

  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  const headers = await authHeaders(page);

  await page.goto('/klar-plus');
  await expect(page.getByRole('note')).toContainText('Noch nicht buchbar');
  await expect(page.getByRole('button', { name: 'Klar+ jetzt entdecken' })).toHaveCount(0);
  expect(legacyRequests).toBe(0);

  const legacy = await page.request.post('/api/analytics/ab-test', {
    headers,
    data: {
      userId: 'ignored',
      eventName: 'klarplus_page_view',
      variant: 'A',
      source: 'KlarPlus_Landing',
    },
  });
  expect(
    legacy.status(),
    `Retired analytics contract expected HTTP 410; got ${legacy.status()}, body=${await legacy.text()}, headers=${JSON.stringify(legacy.headers())}`,
  ).toBe(410);

  const legacyPromo = await page.request.post('/api/claim-launch-promo', {
    headers,
    data: { userId: 'ignored' },
  });
  expect(
    legacyPromo.status(),
    `Retired promo contract expected HTTP 410; got ${legacyPromo.status()}, body=${await legacyPromo.text()}, headers=${JSON.stringify(legacyPromo.headers())}`,
  ).toBe(410);
});
