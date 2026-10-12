import { expect, test } from '@playwright/test';
import { authHeaders, completeAgeAndConsent, enterGuestPreview, waitForAgeGate } from './identity-helpers';

test.describe('identity, onboarding, music, age and consent', () => {
  test('guest reaches preview through mandatory age and consent gates', async ({ page }) => {
    await enterGuestPreview(page);
    await completeAgeAndConsent(page);
    // Anonymous choices are local-only and must not imply a durable API ledger.
    await expect.poll(() => page.evaluate(() =>
      Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
        .some(key => key?.startsWith('klar:guest:consent:')),
    )).toBe(true);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  });

  test('registered account persists music preferences and completes first run', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.getByRole('button', { name: 'Noch kein Konto? Hier registrieren' }).click();
    await page.getByLabel('E-Mail Adresse').fill(`e2e-${crypto.randomUUID()}@example.test`);
    await page.getByLabel('Passwort', { exact: true }).fill('Emulator-only-passphrase-123!');
    await page.getByRole('button', { name: 'Registrieren', exact: true }).click();
    // Legal/age and consent gates are intentionally prior to profile onboarding.
    await waitForAgeGate(page);
    await completeAgeAndConsent(page, 'onboarding', 'registered');
    await expect(page.getByRole('heading', {
      name: 'Echte Verbindungen statt endloses Suchen.',
    })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Jetzt startklar machen' }).click();
    await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Musik', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Musik', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dein Musikgeschmack' })).toBeVisible();
    await page.getByTestId('genre-jazz').click();
    await page.getByLabel('Ich gehe gerne auf Konzerte oder Festivals').check();
    await page.getByLabel('Ich spiele selbst ein Instrument').check();
    await expect(page.getByTestId('genre-jazz')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.getByRole('button', { name: 'Profile entdecken' }).click();
    await page.getByRole('button', { name: 'Loslegen & Verifizieren' }).click();
    // A click starts persistence; it does not await the async submit handler.
    // AuthGate exposes navigation only after the server-confirmed profile update.
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: 15000 });
    const exported = await page.request.get('/api/account/export', { headers: await authHeaders(page) });
    expect(exported.status()).toBe(200);
    expect((await exported.json()).profil.musicPreferences).toEqual({
      genres: ['Jazz'], concertGoer: true, playingInstrument: true,
    });
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Was begeistert dich?' })).toHaveCount(0);
    const reloaded = await page.request.get('/api/account/export', { headers: await authHeaders(page) });
    expect(reloaded.status()).toBe(200);
    expect((await reloaded.json()).profil.musicPreferences).toEqual({
      genres: ['Jazz'], concertGoer: true, playingInstrument: true,
    });
  });

  test('invalid credentials produce an announced error and remain on login', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('E-Mail Adresse').fill('missing@example.test');
    await page.getByLabel('Passwort', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/Falsche E-Mail oder Passwort|Ein Fehler ist aufgetreten/);
    await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();
  });
});
