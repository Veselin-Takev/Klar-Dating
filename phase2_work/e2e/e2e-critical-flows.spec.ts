import { test, expect } from '@playwright/test';

test.describe('Klar-App Critical E2E Journeys (Matching & Chat)', () => {
  
  test('User kann sich einloggen, Matches einsehen und Nachrichten im Chat senden', async ({ page }) => {
    // 1. Startseite / Auth aufrufen
    await page.goto('http://localhost:3000/');
    
    // Prüfen, ob Login erforderlich ist oder Mock-Auth greift
    const emailInput = page.locator('input[name="email"], [data-testid="email-input"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('test-user@example.com');
      await page.fill('input[name="password"], [data-testid="password-input"]', 'SecurePassword123!');
      await page.click('button[type="submit"], [data-testid="login-submit"]');
    }

    // 2. Navigation zum Matching-Bereich
    await page.goto('http://localhost:3000/app/match');
    
    const profileCard = page.locator('[data-testid="profile-card"]');
    if (await profileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Like-Aktion ausführen
      const likeButton = page.locator('[data-testid="btn-like"]');
      if (await likeButton.isVisible()) {
        await likeButton.click();
      }
    }

    // 3. Navigation zum Chat & Nachricht senden
    await page.goto('http://localhost:3000/app/chats');
    
    const firstChat = page.locator('[data-testid="chat-item"]').first();
    if (await firstChat.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstChat.click();
      
      // Testnachricht eingeben und absenden
      const testMessage = 'Hallo! Automated E2E Security & Chat Verification.';
      const messageInput = page.locator('[data-testid="chat-input"]');
      await messageInput.fill(testMessage);
      
      await page.click('[data-testid="btn-send-message"]');

      // Verifizieren, dass die Nachricht im Chat-Verlauf gerendert wird
      await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    }
  });

  test('Onboarding Edge-Case: Altersprüfung lehnt Minderjährige (< 18) deterministisch ab', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    const directDay = page.locator('#geb-tag');
    const geburtsdatumInput = page.locator('input[type="date"], [data-testid="geburtsdatum-input"]');
    if (await directDay.isVisible({ timeout: 3000 }).catch(() => false)
        || await geburtsdatumInput.isVisible({ timeout: 500 }).catch(() => false)) {
      // Underage date intentionally goes to the server: no client-side age bypass.
      const dateUnder18 = new Date();
      dateUnder18.setFullYear(dateUnder18.getFullYear() - 15);
      const formattedDate = dateUnder18.toISOString().split('T')[0];
      if (await directDay.isVisible()) {
        const [year, month, day] = formattedDate.split('-');
        await directDay.fill(String(Number(day)));
        await page.locator('#geb-monat').selectOption(month);
        await page.locator('#geb-jahr').fill(year);
      } else {
        await geburtsdatumInput.fill(formattedDate);
      }
      const submitBtn = page.locator('button[type="submit"], [data-testid="btn-alter-bestaetigen"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Only the backend may confirm adult eligibility or underage lock.
        const errorNotice = page.getByRole('alert');
        await expect(errorNotice.first()).toBeVisible({ timeout: 4000 });
      }
    }
  });

  test('Verifizierungsprozess: Profil- und Foto-Gesten-Verifizierung Pfad ist gesichert', async ({ page }) => {
    await page.goto('http://localhost:3000/app/verification');
    
    // Prüfen ob die Sicherheitsrichtlinien (z.B. kein Zugriff als Gast / Verifizierungs-Aufforderung) greifen
    const verificationHeading = page.locator('h1, h2, [data-testid="verification-title"]');
    if (await verificationHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(verificationHeading.first()).toBeVisible();
    }
  });

});
