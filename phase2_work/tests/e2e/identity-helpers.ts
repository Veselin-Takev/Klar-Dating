import { expect, type Page, type APIRequestContext } from '@playwright/test';

export const emulatorPassword = 'Emulator-only-chat-passphrase-123!';

export async function createAccount(request: APIRequestContext) {
  const email = `test-${crypto.randomUUID()}@example.test`;
  const signup = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only', {
    data: { email, password: emulatorPassword, returnSecureToken: true },
  });
  expect(signup.status()).toBe(200);
  const { localId: uid, idToken } = await signup.json();
  const headers = { Authorization: `Bearer ${idToken}` };
  expect((await request.post('/api/account/alter', { headers, data: { geburtsdatum: '1990-01-01' } })).status()).toBe(200);
  expect((await request.post('/api/einwilligung', { headers, data: { zwecke: { ki_auswertung: false, fehlerberichte: false } } })).status()).toBe(200);
  return { uid: uid as string, email, headers, idToken: idToken as string };
}

export async function markAccountVerified(request: APIRequestContext, uid: string) {
  const patchRes = await request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=isVerified`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: { fields: { isVerified: { booleanValue: true } } },
    }
  );
  expect(patchRes.status()).toBe(200);
}

// Auth/consent transitions include a server write followed by a fresh Firestore read.
// Give that persisted-state roundtrip an explicit budget instead of relying on Playwright's
// generic 5s assertion default. This is a condition wait, not a fixed sleep.
const PERSISTED_UI_TIMEOUT_MS = 15_000;

export async function waitForAgeGate(page: Page) {
  await expect(page.getByRole('heading', { name: 'Wie alt bist du?' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
}

export async function enterGuestPreview(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();
  await page.getByRole('button', { name: 'Als Gast fortfahren' }).click();
  await waitForAgeGate(page);
}

export async function completeAgeAndConsent(page: Page) {
  await page.getByLabel('Geburtsdatum').fill('1990-01-01');
  const ageResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/account/alter' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  expect((await ageResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Womit bist du einverstanden?' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
  const consentResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/einwilligung' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Nichts davon', exact: true }).click();
  const consent = await consentResponse;
  expect(consent.status()).toBe(200);
  expect((await consent.json()).evidenceId).toEqual(expect.any(String));
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
}

export async function authHeaders(page: Page) {
  // Firebase Auth is the source of truth. Guest sessions deliberately use
  // browserSessionPersistence, so their SDK-managed credential is in
  // sessionStorage (not the retired app-owned klar_auth_token key). Read the
  // persisted Firebase user in either supported browser storage area without
  // introducing an application token cache or changing production behavior.
  const token = await page.evaluate(() => {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith('firebase:authUser:')) continue;
        try {
          const user = JSON.parse(storage.getItem(key) || 'null');
          const accessToken = user?.stsTokenManager?.accessToken;
          if (typeof accessToken === 'string' && accessToken.split('.').length === 3) {
            return accessToken;
          }
        } catch {
          // Ignore unrelated or malformed Firebase persistence entries.
        }
      }
    }
    return null;
  });
  expect(token, 'Firebase Auth must persist an authenticated emulator session').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}
