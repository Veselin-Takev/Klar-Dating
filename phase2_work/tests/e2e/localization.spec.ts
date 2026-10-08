import { expect, test } from '@playwright/test';
import { enterGuestPreview, completeAgeAndConsent } from './identity-helpers';

test('login language switches immediately and survives reload', async ({ page }) => {
  await page.goto('/');
  const before = page.url();
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Welcome to Klar' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(page.url()).toBe(before);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  await expect(page.getByRole('heading', { name: 'Welcome to Klar' })).toBeVisible();
});

test('signed-in language preference is acknowledged by the profile API', async ({ page }) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  await page.getByRole('dialog', { name: 'Willkommen bei Klar' }).getByRole('button', { name: 'Einführung überspringen' }).click();
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/preferences' && response.request().method() === 'PATCH');
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ preferences: { language: 'en' } });
  await expect(page.getByRole('status').filter({ hasText: 'Language saved' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
