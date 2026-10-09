import { expect, test } from '@playwright/test';
import {
  authHeaders,
  completeAgeAndConsent,
  createAccount,
  enterGuestPreview,
  markAccountVerified,
} from './identity-helpers';

test('verified accounts can initiate contact, verify quota decrement, undo within 5s and reject duplicate', async ({ request }) => {
  const alice = await createAccount(request);
  const bob = await createAccount(request);
  const unverified = await createAccount(request);

  await markAccountVerified(request, alice.uid);
  await markAccountVerified(request, bob.uid);

  // 1. Unverified user attempting contact is rejected with 409 and grund 'nicht_verifiziert'
  const unverifiedRes = await request.post('/api/contact', {
    headers: unverified.headers,
    data: { targetUid: bob.uid },
  });
  const unverifiedBody = await unverifiedRes.json();
  expect(
    unverifiedRes.status(),
    `unverified contact should return the domain 409, got ${unverifiedRes.status()} body=${JSON.stringify(unverifiedBody)} headers=${JSON.stringify(unverifiedRes.headers())}`,
  ).toBe(409);
  expect(unverifiedBody.grund).toBe('nicht_verifiziert');

  // 2. Verified user Alice contacts Bob -> success, uebrig = 7, gesamt = 8
  const contactRes = await request.post('/api/contact', {
    headers: alice.headers,
    data: { targetUid: bob.uid },
  });
  expect(contactRes.status()).toBe(200);
  const contactBody = await contactRes.json();
  expect(contactBody.ok).toBe(true);
  expect(contactBody.uebrig).toBe(7);
  expect(contactBody.gesamt).toBe(8);

  // 3. Duplicate contact attempt fails immediately with 409 'bereits_kontaktiert'
  const duplicateRes = await request.post('/api/contact', {
    headers: alice.headers,
    data: { targetUid: bob.uid },
  });
  expect(duplicateRes.status()).toBe(409);
  expect((await duplicateRes.json()).grund).toBe('bereits_kontaktiert');

  // 4. Undo contact within 5 seconds succeeds and restores quota
  const undoRes = await request.post('/api/contact/undo', {
    headers: alice.headers,
    data: { targetUid: bob.uid },
  });
  expect(undoRes.status()).toBe(200);
  expect((await undoRes.json()).ok).toBe(true);

  // 5. Check quota restored
  const quotaRes = await request.get('/api/quota', {
    headers: alice.headers,
  });
  expect(quotaRes.status()).toBe(200);
  expect((await quotaRes.json()).uebrig).toBe(8);

  // 6. After undo, re-initiating contact succeeds again
  const recontactRes = await request.post('/api/contact', {
    headers: alice.headers,
    data: { targetUid: bob.uid },
  });
  expect(recontactRes.status()).toBe(200);
  expect((await recontactRes.json()).ok).toBe(true);
});
test('guest cannot initiate contact', async ({ page }) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  const response = await page.request.post('/api/contact', {
    headers: await authHeaders(page), data: { targetUid: 'another-test-account' },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ code: 'konto_erforderlich' });
});

test('underage input is rejected without granting access', async ({ page }) => {
  await enterGuestPreview(page);
  await page.getByLabel('Geburtsdatum').fill('2015-01-01');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('mindestens 18');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wie alt bist du?' })).toBeVisible();
});

test('forged browser age and consent never bypass the mandatory gate', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('klar_is_adult', 'true');
    localStorage.setItem('klar_einwilligung', JSON.stringify({ version: 1, zwecke: { ki_auswertung: true, fehlerberichte: true } }));
    localStorage.setItem('klar_einw_fehlerberichte', 'ja');
  });
  await enterGuestPreview(page);
  const token = await authHeaders(page);
  const status = await page.request.get('/api/account/status', { headers: token });
  expect((await status.json()).isAdult).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wie alt bist du?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
});

test('offline transition and recovery do not crash the app', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: 'Keine Internetverbindung' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();
});

test('disabled anonymous sign-in never creates a permanent fallback account', async ({ page }) => {
  const attempts: Record<string, unknown>[] = [];
  await page.route('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp**', async route => {
    attempts.push(route.request().postDataJSON());
    await route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 400, message: 'ADMIN_ONLY_OPERATION' } }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Als Gast fortfahren' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(attempts.length).toBeGreaterThan(0);
  for (const attempt of attempts) {
    expect(attempt).not.toHaveProperty('email');
    expect(attempt).not.toHaveProperty('password');
  }
  await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();
});
