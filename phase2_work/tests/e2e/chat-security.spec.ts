import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const emulatorPassword = 'Emulator-only-chat-passphrase-123!';
async function createAccount(request: APIRequestContext) {
  const email = `chat-${crypto.randomUUID()}@example.test`;
  const signup = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only', {
    data: { email, password: emulatorPassword, returnSecureToken: true },
  });
  expect(signup.status()).toBe(200);
  const { localId: uid, idToken } = await signup.json();
  const headers = { Authorization: `Bearer ${idToken}` };
  expect((await request.post('/api/account/alter', { headers, data: { geburtsdatum: '1990-01-01' } })).status()).toBe(200);
  expect((await request.post('/api/einwilligung', { headers, data: { zwecke: { ki_auswertung: false, fehlerberichte: false } } })).status()).toBe(200);
  // These chat journeys start after mandatory age/consent gates. Seed a persisted
  // profile interest so AuthGate can complete its real onboarding gate; never
  // rely on the removed unscoped localStorage onboarding flag.
  const profile = await request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=interests`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: { fields: { interests: { arrayValue: { values: [{ stringValue: 'Musik' }] } } } },
    },
  );
  expect(profile.status(), 'chat fixture should seed persisted onboarding completion').toBe(200);
  return { uid: uid as string, email, headers };
}
async function seedChat(request: APIRequestContext, participants: string[]) {
  // Fixed loopback demo endpoint: these fixtures cannot reach production.
  const chatId = 'browser-' + crypto.randomUUID();
  const result = await request.patch(`http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/chats/${chatId}`, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields: {
      participants: { arrayValue: { values: participants.map(stringValue => ({ stringValue })) } },
      gateAntwortenA: { integerValue: '0' }, gateAntwortenB: { integerValue: '0' },
      gateFragen: { arrayValue: { values: [{ stringValue: 'Welche Musik magst du?' }, { stringValue: 'Was möchtest du kennenlernen?' }] } },
    } },
  });
  expect(result.status()).toBe(200); return chatId;
}
async function signIn(page: Page, email: string, chatId: string) {
  await page.goto(`/chat/${chatId}`);
  await page.getByLabel('E-Mail Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(emulatorPassword);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  const introduction = page.getByRole('dialog', { name: 'Willkommen bei Klar' });
  await expect(introduction).toBeVisible({ timeout: 15000 });
  await introduction.getByRole('button', { name: 'Einführung überspringen', exact: true }).click();
  await expect(introduction).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Icebreaker-Gate' })).toBeVisible({ timeout: 15000 });
}

test('two accounts complete the gate, persist a message and enforce blocking', async ({ page, request }) => {
  test.setTimeout(60000);
  const alice = await createAccount(request); const bob = await createAccount(request); const outsider = await createAccount(request);
  const chatId = await seedChat(request, [alice.uid, bob.uid]);
  const send = (headers: Record<string, string>, text: string) => request.post('/api/messages/send', { headers, data: { chatId, text } });
  expect((await send(outsider.headers, 'foreign message')).status()).toBe(403);
  expect((await send(alice.headers, 'closed gate')).status()).toBe(403);
  await signIn(page, alice.email, chatId);
  await expect(page.getByLabel('Nachricht eingeben')).toHaveCount(0);
  await page.getByLabel('Deine Antwort', { exact: true }).fill('Jazz');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(page.getByText('Was möchtest du kennenlernen?', { exact: true })).toBeVisible();
  await page.getByLabel('Deine Antwort', { exact: true }).fill('Neue Menschen');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wartet auf Antwort' })).toBeVisible();
  for (const antwort of ['Jazz', 'Gute Gespräche']) {
    expect((await request.post('/api/gate/answer', { headers: bob.headers, data: { chatId, antwort } })).status()).toBe(200);
  }
  await page.getByRole('button', { name: 'Status erneut prüfen' }).click();
  const message = 'Hallo, gemeinsam hören wir Jazz.';
  await page.getByLabel('Nachricht eingeben').fill(message);
  const sent = page.waitForResponse(response => new URL(response.url()).pathname === '/api/messages/send');
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  expect((await sent).status()).toBe(200);
  await expect(page.getByLabel('Nachricht eingeben')).toHaveValue('');
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText(message, { exact: true })).toBeVisible();
  expect((await request.post('/api/block', { headers: bob.headers, data: { targetUid: alice.uid } })).status()).toBe(200);
  expect((await send(alice.headers, 'blocked')).status()).toBe(403);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Status erneut prüfen' })).toBeVisible();
  await expect(page.getByLabel('Nachricht eingeben')).toHaveCount(0);
});

test('a failed status request keeps the composer closed until a successful retry', async ({ page, request }) => {
  const alice = await createAccount(request); const bob = await createAccount(request);
  const chatId = await seedChat(request, [alice.uid, bob.uid]);
  let failing = true;
  await page.route('**/api/gate/status?**', route => failing
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' })
    : route.continue());
  await signIn(page, alice.email, chatId);
  await expect(page.getByRole('alert').filter({ hasText: 'Gesprächsstatus' })).toBeVisible();
  await expect(page.getByLabel('Nachricht eingeben')).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Status erneut prüfen' }).click();
  await expect(page.getByLabel('Deine Antwort', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nachricht eingeben')).toHaveCount(0);
});
