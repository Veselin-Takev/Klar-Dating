import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAccount, emulatorPassword } from './identity-helpers';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents';

async function patchFixture(request: APIRequestContext, path: string, fields: Record<string, unknown>) {
  const response = await request.patch(`${FIRESTORE_EMULATOR}/${path}`, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields },
  });
  expect(response.status(), `Firestore emulator fixture write failed for ${path}`).toBe(200);
}

test('CUJ 4: Art. 17 request removes discoverability and clears only the account-scoped browser state', async ({ page, request }) => {
  test.setTimeout(60000);
  const account = await createAccount(request);
  await patchFixture(request, `users/${account.uid}`, {
    interests: { arrayValue: { values: [{ stringValue: 'Musik' }] } },
  });
  await patchFixture(request, `public_profiles/${account.uid}`, {
    uid: { stringValue: account.uid },
    isVerified: { booleanValue: true },
    active: { booleanValue: true },
  });

  await page.goto('/');
  await page.getByLabel('E-Mail Adresse').fill(account.email);
  await page.getByLabel('Passwort', { exact: true }).fill(emulatorPassword);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: 15000 });
  await page.goto('/profile');
  const introduction = page.getByRole('dialog', { name: 'Willkommen bei Klar' });
  await expect(introduction).toBeVisible();
  await introduction.getByRole('button', { name: 'Einführung überspringen', exact: true }).click();
  await page.getByRole('tab', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Erweitert & Konto' }).click();
  await expect(page.getByRole('button', { name: 'Konto löschen' })).toBeVisible();

  await page.evaluate((uid) => {
    localStorage.setItem(`klar:user:${uid}:userInterests`, JSON.stringify(['Musik']));
    localStorage.setItem(`klar:user:${uid}:klar_user_bio`, 'emulator-only fixture');
    localStorage.setItem('klar_theme', 'fixture-preserved');
  }, account.uid);

  await page.getByRole('button', { name: 'Konto löschen' }).click();
  const deletionResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/account/delete'
    && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Wirklich löschen — endgültig' }).click();
  const accepted = await deletionResponse;
  expect(accepted.status()).toBe(202);
  const receipt = await accepted.json();
  expect(receipt).toMatchObject({ ok: true, status: 'pending' });
  expect(receipt.requestId).toEqual(expect.any(String));

  await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible({ timeout: 15000 });
  const browserState = await page.evaluate((uid) => ({
    remaining: Object.keys(localStorage).filter(key => key.startsWith(`klar:user:${uid}:`)),
    globalTheme: localStorage.getItem('klar_theme'),
  }), account.uid);
  expect(browserState.remaining).toEqual([]);
  expect(browserState.globalTheme).toBe('fixture-preserved');

  const deletionJob = await request.get(`${FIRESTORE_EMULATOR}/account_deletions/${account.uid}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  expect(deletionJob.status()).toBe(200);
  expect((await deletionJob.json()).fields.status.stringValue).toBe('pending');

  const publicProfile = await request.get(`${FIRESTORE_EMULATOR}/public_profiles/${account.uid}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  expect(publicProfile.status()).toBe(404);
  const user = await request.get(`${FIRESTORE_EMULATOR}/users/${account.uid}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  expect(user.status()).toBe(200);
  expect((await user.json()).fields.isVerified.booleanValue).toBe(false);
});
