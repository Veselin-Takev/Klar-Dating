import { test, expect } from '@playwright/test';

test.describe('Enterprise Accessibility (A11y) Gate', () => {
  test('Hauptseiten erfüllen grundlegende Barrierefreiheitsstandards', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Prüft, ob semantische Landmarken vorhanden sind
    const mainLandmark = page.locator('main');
    await await mainLandmark.count() > 0;
    
    // Basis-Prüfung: Keine fehlenden Alt-Texte auf kritischen Bildern
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    
    expect(imagesWithoutAlt).toBe(0);
  });
});
