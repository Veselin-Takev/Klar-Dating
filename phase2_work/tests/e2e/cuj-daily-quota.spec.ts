import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createAccount, emulatorPassword, markAccountVerified } from './identity-helpers';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents';

async function patchFixture(
  request: APIRequestContext,
  documentPath: string,
  fields: Record<string, unknown>,
  updateMask?: string,
) {
  const suffix = updateMask ? `?updateMask.fieldPaths=${encodeURIComponent(updateMask)}` : '';
  const response = await request.patch(`${FIRESTORE_EMULATOR}/${documentPath}${suffix}`, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields },
  });
  expect(response.status(), `Firestore emulator fixture write failed for ${documentPath}`).toBe(200);
}

async function seedDiscoverableTarget(request: APIRequestContext, uid: string) {
  // The contact transaction requires an existing target user and rejects
  // account-deletion tombstones. These fixture docs exist only in demo-klar.
  await patchFixture(request, `users/${uid}`, {
    isAdult: { booleanValue: true },
    isVerified: { booleanValue: true },
    active: { booleanValue: true },
    displayName: { stringValue: 'Deterministic E2E profile' },
  });
}

async function signInToDashboard(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-Mail Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(emulatorPassword);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Für heute geschafft.' })).toBeVisible({ timeout: 15000 });
}

for (const plan of ['frei', 'plus'] as const) {
  test(`CUJ 2: ${plan} plan is hard-limited to eight daily contacts in API and UI`, async ({ request, page }) => {
    test.setTimeout(90000);
    const account = await createAccount(request);
    await markAccountVerified(request, account.uid);
    await patchFixture(request, `users/${account.uid}`, {
      interests: { arrayValue: { values: [{ stringValue: 'Musik' }] } },
    }, 'interests');
    await patchFixture(request, `users/${account.uid}`, {
      plan: { stringValue: plan },
    }, 'plan');

    for (let index = 0; index < 8; index += 1) {
      const targetUid = `cuj-target-${account.uid.slice(0, 8)}-${index}`;
      await seedDiscoverableTarget(request, targetUid);
      const response = await request.post('/api/contact', {
        headers: account.headers,
        data: { targetUid },
      });
      expect(response.status(), `contact ${index + 1} should be allowed for plan ${plan}`).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, uebrig: 7 - index, gesamt: 8 });
    }

    const ninthTarget = `cuj-target-${account.uid.slice(0, 8)}-ninth`;
    await seedDiscoverableTarget(request, ninthTarget);
    const ninth = await request.post('/api/contact', {
      headers: account.headers,
      data: { targetUid: ninthTarget },
    });
    expect(ninth.status()).toBe(409);
    expect(await ninth.json()).toMatchObject({ ok: false, grund: 'limit' });

    const quota = await request.get('/api/quota', { headers: account.headers });
    expect(quota.status()).toBe(200);
    expect(await quota.json()).toMatchObject({ uebrig: 0, gesamt: 8, plan });

    // The authenticated dashboard uses the same server quota result; a client
    // plan label or local storage value cannot restore another contact.
    await signInToDashboard(page, account.email);
  });
}
