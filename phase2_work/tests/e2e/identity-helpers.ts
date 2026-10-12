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

export async function completeAgeAndConsent(page: Page, next: 'navigation' | 'onboarding' = 'navigation', mode: 'guest' | 'registered' = 'guest') {
  await page.getByLabel('Geburtsdatum').fill('1990-01-01');
  const ageResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/account/alter' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  expect((await ageResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Womit bist du einverstanden?' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
  if (mode === 'guest') {
    // Guest decisions are session-scoped, never fabricated server audit records.
    await page.getByRole('button', { name: 'Nichts davon', exact: true }).click();
    await expect.poll(() => page.evaluate(() => {
      const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i));
      const guestKey = keys.find(key => key?.startsWith('klar:guest:consent:'));
      if (!guestKey) return null;
      try {
        const record = JSON.parse(sessionStorage.getItem(guestKey) || 'null');
        return record?.zwecke;
      } catch { return null; }
    })).toMatchObject({ ki_auswertung: false, fehlerberichte: false, produktanalyse: false });
  } else {
    const consentResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/einwilligung' && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Nichts davon', exact: true }).click();
    const consent = await consentResponse;
    expect(consent.status()).toBe(200);
    expect((await consent.json()).evidenceId).toEqual(expect.any(String));
  }
  if (next === 'onboarding') {
    await expect(page.getByRole('heading', { name: 'Echte Verbindungen statt endloses Suchen.' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
  } else {
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: PERSISTED_UI_TIMEOUT_MS });
  }
}

export async function authHeaders(page: Page) {
  // Firebase Auth is the source of truth. Depending on the SDK persistence
  // selected by the app, the user may be stored in IndexedDB, sessionStorage,
  // or localStorage. Inspect SDK-owned persistence read-only; never add an
  // application-owned token cache just to satisfy this test.
  const token = await page.evaluate(async () => {
    const isJwt = (value: unknown): value is string =>
      typeof value === 'string' && value.split('.').length === 3;

    for (const storage of [window.sessionStorage, window.localStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith('firebase:authUser:')) continue;
        try {
          const user = JSON.parse(storage.getItem(key) || 'null');
          const accessToken = user?.stsTokenManager?.accessToken;
          if (isJwt(accessToken)) return accessToken;
        } catch {
          // Ignore unrelated or malformed Firebase persistence entries.
        }
      }
    }

    // Firebase's default browserLocalPersistence uses this SDK-owned database.
    // Check that it already exists before opening it, to avoid creating a
    // database or changing the app's persistence behavior in the test.
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      if (databases.some(database => database.name === 'firebaseLocalStorageDb')) {
        const db = await new Promise<IDBDatabase | null>(resolve => {
          const request = indexedDB.open('firebaseLocalStorageDb');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        });
        if (db) {
          try {
            if (db.objectStoreNames.contains('firebaseLocalStorage')) {
              const records = await new Promise<unknown[]>(resolve => {
                const transaction = db.transaction('firebaseLocalStorage', 'readonly');
                const request = transaction.objectStore('firebaseLocalStorage').getAll();
                request.onsuccess = () => resolve(request.result as unknown[]);
                request.onerror = () => resolve([]);
                transaction.onabort = () => resolve([]);
              });
              for (const record of records) {
                if (!record || typeof record !== 'object') continue;
                const rawValue = (record as { value?: unknown }).value;
                let value: unknown = rawValue;
                if (typeof rawValue === 'string') {
                  try { value = JSON.parse(rawValue) as unknown; } catch { continue; }
                }
                if (!value || typeof value !== 'object') continue;
                const persisted = value as {
                  stsTokenManager?: { accessToken?: unknown };
                  value?: { stsTokenManager?: { accessToken?: unknown } } | string;
                };
                const nested = typeof persisted.value === 'string'
                  ? (() => { try { return JSON.parse(persisted.value) as { stsTokenManager?: { accessToken?: unknown } }; } catch { return null; } })()
                  : persisted.value;
                const accessToken = persisted.stsTokenManager?.accessToken ?? nested?.stsTokenManager?.accessToken;
                if (isJwt(accessToken)) return accessToken;
              }
            }
          } finally {
            db.close();
          }
        }
      }
    }
    return null;
  });
  expect(token, 'Firebase Auth must persist an authenticated emulator session').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}
