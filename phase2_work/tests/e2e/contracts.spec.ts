import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('cancellation works without sign-in or JavaScript and produces a durable receipt', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000/vertraege/kuendigen');
  await expect(page.getByRole('heading', { name: 'Verträge hier kündigen' })).toBeVisible();
  await page.getByLabel('Vollständiger Name').fill('Browser Test');
  await page.getByLabel('E-Mail für die Bestätigung').fill('browser@example.test');
  await page.getByLabel('Vertrag oder Vertragsnummer').fill('Testvertrag ohne Kontozuordnung');
  await page.getByRole('button', { name: 'jetzt kündigen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Eingangsbestätigung', exact: true })).toBeVisible();
  await expect(page.locator('pre')).toContainText('Testvertrag ohne Kontozuordnung');
  await expect(page.locator('pre')).toContainText('frühestmöglichen Zeitpunkt gemäß § 312k Abs. 5 BGB');
  await expect(page.locator('pre')).toContainText('Eingang (UTC)');
  await expect(page.getByRole('link', { name: 'Bestätigung als Textdatei speichern' })).toHaveAttribute('download', /Klar-.*\.txt/);
  await context.close();
});

test('withdrawal form is localized, accessible and accepts a separate declaration', async ({ page }) => {
  await page.goto('/vertraege/widerrufen?lang=en');
  await expect(page.getByRole('heading', { name: 'Withdraw from contract' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.getByLabel('Full name').fill('Withdrawal Test');
  await page.getByLabel('Email for confirmation').fill('withdraw@example.test');
  await page.getByLabel('Contract or contract number').fill('Klar Plus');
  await page.getByRole('button', { name: 'Confirm withdrawal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acknowledgement of receipt' })).toBeVisible();
  await expect(page.locator('pre')).toContainText('declare withdrawal');
});
