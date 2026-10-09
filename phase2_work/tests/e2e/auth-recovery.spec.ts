import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('magic link signs in on another device without trusting an email in the URL', async ({ page, browser }) => {
  const email = `magic-${crypto.randomUUID()}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zugang wiederherstellen' });
  await expect(dialog).toBeVisible();
  const audit = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await dialog.getByLabel('E-Mail Adresse').fill(email);
  await dialog.getByRole('button', { name: 'Anmeldelink senden' }).click();
  await expect(dialog.getByRole('status')).toContainText('Der Anmeldelink wurde versendet');
  const response = await page.request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-klar/oobCodes');
  expect(response.ok()).toBe(true);
  const body = await response.json() as { oobCodes: Array<{ email: string; oobCode: string; oobLink: string }> };
  const code = body.oobCodes.find(entry => entry.email === email);
  expect(code).toBeDefined();
  const callback = new URL('/login', 'http://localhost:3000');
  callback.searchParams.set('mode', 'signIn');
  callback.searchParams.set('oobCode', code!.oobCode);
  callback.searchParams.set('apiKey', new URL(code!.oobLink).searchParams.get('apiKey')!);
  callback.searchParams.set('email', 'attacker@example.test');
  const otherDevice = await browser.newContext();
  try {
    const receiver = await otherDevice.newPage();
    await receiver.goto(callback.href);
    await expect(receiver.getByRole('heading', { name: 'Anmeldung bestätigen' })).toBeVisible();
    await expect(receiver.getByLabel('E-Mail Adresse')).toBeEmpty();
    await receiver.getByLabel('E-Mail Adresse').fill(email);
    await receiver.getByRole('button', { name: 'Anmelden', exact: true }).click();
    // Email-link auth may create a new account; the mandatory age gate must run before onboarding.
    await expect(receiver.getByRole('heading', { name: 'Wie alt bist du?' })).toBeVisible({ timeout: 15000 });
    await expect(receiver.getByLabel('Geburtsdatum')).toBeVisible();
    expect(new URL(receiver.url()).search).toBe('');
  } finally { await otherDevice.close(); }
});

test('recovery dialog restores keyboard focus on Escape', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Passwort vergessen?' });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Dialog schließen' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
