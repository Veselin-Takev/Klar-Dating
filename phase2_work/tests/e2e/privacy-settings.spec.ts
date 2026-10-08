import { expect, test } from '@playwright/test';
import { authHeaders, completeAgeAndConsent, enterGuestPreview } from './identity-helpers';

test('product analytics consent gates collection before grant and after withdrawal', async ({ page }) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  const headers = await authHeaders(page);
  const event = { step: 'onboarding_started', sessionId: 'e2e-consent-session-123' };

  const beforeGrant = await page.request.post('/api/analytics/track', { headers, data: event });
  expect(beforeGrant.status()).toBe(403);

  const grant = await page.request.post('/api/einwilligung', { headers, data: { zwecke: { produktanalyse: true } } });
  expect(grant.status()).toBe(200);

  const afterGrant = await page.request.post('/api/analytics/track', { headers, data: event });
  expect(afterGrant.status()).toBe(201);
  await page.goto('/profile');
  await page.getByRole('dialog', { name: 'Willkommen bei Klar' })
    .getByRole('button', { name: 'Einführung überspringen' }).click();
  await page.getByRole('tab', { name: 'Einstellungen', exact: true }).click();
  const section = page.getByRole('region', { name: 'Datenschutz und Einwilligungen' });
  const withdrawal = page.waitForResponse(response => new URL(response.url()).pathname === '/api/einwilligung/widerruf');
  await section.getByRole('button', { name: 'Produktanalyse widerrufen' }).click();
  expect((await withdrawal).status()).toBe(200);
  await expect(section.getByRole('status')).toHaveText('Einwilligung wurde widerrufen.');
  await expect(section.getByText('Produktanalyse: Nicht erlaubt')).toBeVisible();
  const saved = await page.request.get('/api/einwilligung', { headers });
  expect((await saved.json()).einwilligung.zwecke.produktanalyse).toBe(false);

  const afterWithdrawal = await page.request.post('/api/analytics/track', { headers, data: event });
  expect(afterWithdrawal.status()).toBe(403);
});
