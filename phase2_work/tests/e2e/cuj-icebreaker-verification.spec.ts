import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createAccount, emulatorPassword } from './identity-helpers';

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents';

async function patchFixture(request: APIRequestContext, path: string, fields: Record<string, unknown>) {
  const response = await request.patch(`${FIRESTORE_EMULATOR}/${path}`, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields },
  });
  expect(response.status(), `Firestore emulator fixture write failed for ${path}`).toBe(200);
}

async function seedOnboarding(request: APIRequestContext, uid: string) {
  await patchFixture(request, `users/${uid}`, {
    interests: { arrayValue: { values: [{ stringValue: 'Musik' }] } },
  });
}

async function signInToChat(page: Page, email: string, chatId: string) {
  await page.goto(`/chat/${chatId}`);
  await page.getByLabel('E-Mail Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(emulatorPassword);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  const introduction = page.getByRole('dialog', { name: 'Willkommen bei Klar' });
  await expect(introduction).toBeVisible({ timeout: 15000 });
  await introduction.getByRole('button', { name: 'Einführung überspringen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Icebreaker-Gate' })).toBeVisible({ timeout: 15000 });
}

async function answerBothQuestions(page: Page) {
  for (const answer of ['Jazz', 'Neue Menschen kennenlernen']) {
    const saved = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/gate/answer'
      && response.request().method() === 'POST',
    );
    await page.getByLabel('Deine Antwort', { exact: true }).fill(answer);
    await page.getByRole('button', { name: 'Antworten', exact: true }).click();
    expect((await saved).status()).toBe(200);
  }
}

test('CUJ 3: the free chat unlocks symmetrically only after both users answer both questions', async ({ request, browser }) => {
  test.setTimeout(90000);
  const alice = await createAccount(request);
  const bob = await createAccount(request);
  await seedOnboarding(request, alice.uid);
  await seedOnboarding(request, bob.uid);

  const chatId = `cuj-${crypto.randomUUID()}`;
  await patchFixture(request, `chats/${chatId}`, {
    participants: { arrayValue: { values: [alice.uid, bob.uid].sort().map(stringValue => ({ stringValue })) } },
    gateAntwortenA: { integerValue: '0' },
    gateAntwortenB: { integerValue: '0' },
    gateFragen: { arrayValue: { values: [
      { stringValue: 'Welche Musik magst du?' },
      { stringValue: 'Was möchtest du kennenlernen?' },
    ] } },
  });

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  try {
    const alicePage = await aliceContext.newPage();
    await signInToChat(alicePage, alice.email, chatId);
    await expect(alicePage.getByLabel('Nachricht eingeben')).toHaveCount(0);
    await answerBothQuestions(alicePage);
    await expect(alicePage.getByRole('heading', { name: 'Wartet auf Antwort' })).toBeVisible();
    await expect(alicePage.getByLabel('Nachricht eingeben')).toHaveCount(0);

    const bobPage = await bobContext.newPage();
    await signInToChat(bobPage, bob.email, chatId);
    await expect(bobPage.getByLabel('Nachricht eingeben')).toHaveCount(0);
    await answerBothQuestions(bobPage);
    // Bob's second persisted answer makes the server return "offen" for his
    // own session; Alice's waiting state remains closed until a fresh read.
    await expect(bobPage.getByLabel('Nachricht eingeben')).toBeVisible({ timeout: 15000 });
    await expect(alicePage.getByRole('button', { name: 'Status erneut prüfen' })).toBeVisible();
    await alicePage.getByRole('button', { name: 'Status erneut prüfen' }).click();
    await expect(alicePage.getByLabel('Nachricht eingeben')).toBeVisible({ timeout: 15000 });
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test('CUJ 3: stale "verified" status cannot override a false server isVerified flag', async ({ request }) => {
  const account = await createAccount(request);
  await patchFixture(request, `users/${account.uid}`, {
    isVerified: { booleanValue: false },
    verificationStatus: { stringValue: 'bestaetigt' },
  });
  const targetUid = `cuj-unverified-target-${account.uid.slice(0, 8)}`;
  await patchFixture(request, `users/${targetUid}`, {
    isAdult: { booleanValue: true },
    isVerified: { booleanValue: true },
    active: { booleanValue: true },
  });

  const response = await request.post('/api/contact', {
    headers: account.headers,
    data: { targetUid },
  });
  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ ok: false, grund: 'nicht_verifiziert' });
  const contact = await request.get(`${FIRESTORE_EMULATOR}/contacts/${account.uid}_${targetUid}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  expect(contact.status()).toBe(404);
});
