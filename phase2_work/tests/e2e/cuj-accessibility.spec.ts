import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { completeAgeAndConsent, enterGuestPreview } from './identity-helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function expectNoSeriousOrCriticalAxeViolations(page: Page, view: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const severe = results.violations.filter(violation =>
    violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(
    severe,
    `${view}: ${severe.map(violation =>
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
        .flatMap(node => node.target).join(', ')}`,
    ).join('\n')}`,
  ).toEqual([]);
}

test('CUJ 5: onboarding age/consent and dashboard views have no serious or critical WCAG A/AA issues', async ({ page }) => {
  await enterGuestPreview(page);
  await expect(page.getByRole('heading', { name: 'Wie alt bist du?' })).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, 'Age gate');

  await page.getByLabel('Geburtsdatum').fill('1990-01-01');
  const ageResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/account/alter'
    && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  expect((await ageResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Womit bist du einverstanden?' })).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, 'Consent gate');

  await page.getByRole('button', { name: 'Nichts davon', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible({ timeout: 15000 });
  await expectNoSeriousOrCriticalAxeViolations(page, 'Dashboard');
});

test('CUJ 5: Profile safety and account controls have no serious or critical WCAG A/AA issues', async ({ page }) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  await page.goto('/profile');
  const introduction = page.getByRole('dialog', { name: 'Willkommen bei Klar' });
  await expect(introduction).toBeVisible();
  await introduction.getByRole('button', { name: 'Einführung überspringen', exact: true }).click();
  await page.getByRole('tab', { name: 'Einstellungen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Datenschutz und Einwilligungen' })).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, 'Profile safety / consent settings');

  await page.getByRole('button', { name: 'Erweitert & Konto' }).click();
  await expect(page.getByRole('button', { name: 'Konto löschen' })).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, 'Profile safety / account controls');
});

test('SPA navigation moves keyboard focus to the main content landmark', async ({ page }) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  await page.getByRole('link', { name: /Chats|Gespräche/ }).first().click();
  await expect(page).toHaveURL(/\/chats$/);
  await expect(page.locator('main#inhalt')).toBeFocused();
});
