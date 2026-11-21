import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAccount, emulatorPassword } from './identity-helpers';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents';

async function patchFixture(
  request: APIRequestContext,
  path: string,
  fields: Record<string, unknown>,
  updateMask: string[] = [],
) {
  const query = new URLSearchParams();
  for (const field of updateMask) query.append('updateMask.fieldPaths', field);
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await request.patch(`${FIRESTORE_EMULATOR}/${path}${suffix}`, {
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
  }, ['interests']);
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

  let resolveCapture!: (capture: { status: number; receipt: unknown }) => void;
  let rejectCapture!: (error: Error) => void;
  const capturePromise = new Promise<{ status: number; receipt: unknown }>((resolve, reject) => {
    resolveCapture = resolve;
    rejectCapture = reject;
  });
  const deletionRoute = '**/api/account/delete';

  await page.route(deletionRoute, async (route) => {
    const originalRequest = route.request();
    if (originalRequest.method() !== 'POST') {
      await route.continue();
      return;
    }

    try {
      // Capture the upstream response through the independent API context before
      // fulfilling the browser request, whose success immediately triggers navigation.
      const headers = await originalRequest.allHeaders();
      for (const header of ['host', 'content-length', 'connection', 'accept-encoding']) {
        delete headers[header];
      }
      const upstream = await request.fetch(originalRequest.url(), {
        method: originalRequest.method(),
        headers,
        data: originalRequest.postDataBuffer() ?? undefined,
      });
      const responseBody = await upstream.body();
      const status = upstream.status();
      const receipt: unknown = JSON.parse(responseBody.toString('utf8'));

      // Resolve only after both status and the complete JSON receipt are captured.
      resolveCapture({ status, receipt });

      const responseHeaders = Object.fromEntries(
        Object.entries(upstream.headers()).filter(([name]) =>
          !['content-length', 'transfer-encoding', 'connection', 'content-encoding', 'keep-alive'].includes(name.toLowerCase()),
        ),
      );
      await route.fulfill({
        status,
        headers: responseHeaders,
        body: responseBody,
      });
    } catch (error) {
      rejectCapture(error instanceof Error ? error : new Error(String(error)));
      await route.abort().catch(() => undefined);
    }
  });

  // Account deletion signs out and then performs a full document reload.
  // Subscribe before the confirmation click so the transient signed-out render
  // cannot race the subsequent account-scoped localStorage inspection.
  const postDeletionNavigation = page.waitForNavigation({ waitUntil: 'load' });
  const [{ status: deletionStatus, receipt: deletionReceipt }] = await Promise.all([
    capturePromise,
    page.getByRole('button', { name: 'Wirklich löschen — endgültig' }).click(),
    postDeletionNavigation,
  ]);
  expect(deletionStatus).toBe(202);
  expect(deletionReceipt).toMatchObject({ ok: true, status: 'pending' });
  expect((deletionReceipt as { requestId?: unknown } | undefined)?.requestId).toEqual(expect.any(String));

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

  // capturePromise resolves before route.fulfill() has necessarily settled. Remove
  // routes only after every Art. 17 assertion, without waiting on an in-flight callback.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
