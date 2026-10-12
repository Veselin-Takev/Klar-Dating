import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Legal & Statutory Compliance E2E Flows', () => {
  test('Datenschutzerklärung provides full DSGVO Art. 13/14 transparency & passes WCAG AA', async ({ page }) => {
    await page.goto('/rechtstexte/datenschutz');
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
    await expect(page.getByText('Verantwortliche Stelle (Art. 4 Nr. 7 DSGVO)')).toBeVisible();
    await expect(page.getByText('Klar Technologies GmbH i.Gr.')).toBeVisible();
    await expect(page.getByText('Berliner Beauftragte für Datenschutz')).toBeVisible();

    // Check accessibility
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('AGB & Widerrufsbelehrung includes statutory § 312k and § 356a BGB mandates', async ({ page }) => {
    await page.goto('/rechtstexte/agb');
    await expect(page.getByRole('heading', { name: 'Allgemeine Geschäftsbedingungen (AGB)' })).toBeVisible();
    await expect(page.getByText('Gesetzliche Widerrufsbelehrung (§ 356a BGB)')).toBeVisible();
    await expect(page.getByText('Kündigungsbutton & Beendigung (§ 312k BGB)')).toBeVisible();
    await expect(page.getByText('DSA-Meldewege')).toBeVisible();
  });

  test('Impressum provides § 5 DDG, DSA Art. 11/12 contact point and youth protection officer', async ({ page }) => {
    await page.goto('/rechtstexte/impressum');
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
    await expect(page.getByText('Zentrale Kontaktstelle nach dem Digital Services Act (DSA)')).toBeVisible();
    await expect(page.getByText('Jugendschutzbeauftragter (§ 7 JMStV)')).toBeVisible();
    await expect(page.getByText('dsa-legal@klar-app.de')).toBeVisible();
  });

  test('Tab navigation allows seamless switching between statutory texts', async ({ page }) => {
    await page.goto('/rechtstexte/datenschutz');
    await expect(page.getByRole('tab', { name: 'Datenschutz (DSGVO)' })).toHaveAttribute('aria-selected', 'true');

    // Click AGB tab
    await page.getByRole('tab', { name: 'AGB & Widerruf' }).click();
    await expect(page.getByRole('heading', { name: 'Allgemeine Geschäftsbedingungen (AGB)' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AGB & Widerruf' })).toHaveAttribute('aria-selected', 'true');

    // Click Impressum tab
    await page.getByRole('tab', { name: 'Impressum (§ 5 DDG & DSA)' }).click();
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Impressum (§ 5 DDG & DSA)' })).toHaveAttribute('aria-selected', 'true');

    // The accessible back button returns to the previous in-app view,
    // which in this flow is the AGB tab, not the application root.
    const back = page.getByRole('button', { name: 'Zurück zur App' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole('heading', { name: 'Allgemeine Geschäftsbedingungen (AGB)' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AGB & Widerruf' })).toHaveAttribute('aria-selected', 'true');
  });
});
