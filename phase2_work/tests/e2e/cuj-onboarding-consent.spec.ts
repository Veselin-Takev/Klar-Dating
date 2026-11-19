import { expect, test } from '@playwright/test';
import { authHeaders, completeAgeAndConsent, enterGuestPreview } from './identity-helpers';

test('CUJ 1: optional product-analysis consent is user-selectable and persisted', async ({ page }) => {
  // The existing critical-flow and onboarding specs own the under-18 rejection
  // and the mandatory age gate. This test adds the optional-purpose UI toggle
  // and verifies the server-authoritative readback.
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);

  await page.goto('/profile');
  const introduction = page.getByRole('dialog', { name: 'Willkommen bei Klar' });
  await expect(introduction).toBeVisible();
  await introduction.getByRole('button', { name: 'Einführung überspringen', exact: true }).click();

  await page.getByRole('tab', { name: 'Einstellungen', exact: true }).click();
  const consent = page.getByRole('region', { name: 'Datenschutz und Einwilligungen' });
  await expect(consent.getByRole('button', { name: 'Produktanalyse erlauben' })).toBeVisible();
  await expect(consent.getByText('Produktanalyse: Nicht erlaubt')).toBeVisible();

  const grant = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/einwilligung/zweck'
    && response.request().method() === 'POST'
    && response.request().postDataJSON()?.zweck === 'produktanalyse'
    && response.request().postDataJSON()?.erlaubt === true,
  );
  await consent.getByRole('button', { name: 'Produktanalyse erlauben' }).click();
  expect((await grant).status()).toBe(200);
  await expect(consent.getByRole('status')).toHaveText('Einwilligung wurde erteilt.');
  await expect(consent.getByText('Produktanalyse: Erlaubt')).toBeVisible();

  const persisted = await page.request.get('/api/einwilligung', { headers: await authHeaders(page) });
  expect(persisted.status()).toBe(200);
  const record = (await persisted.json()).einwilligung;
  expect(record.zwecke.produktanalyse).toBe(true);
  expect(record.evidenceId).toEqual(expect.any(String));
});
