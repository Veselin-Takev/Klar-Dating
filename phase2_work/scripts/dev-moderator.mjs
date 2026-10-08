// ═══════════════════════════════════════════════════════════════════════════
// Moderator-Anspruch im laufenden Auth-Emulator setzen
//
// WOZU: K-1 (Verifizierung) und `/api/system-health` verlangen den Anspruch
// `moderator: true`. Ohne ihn ist die Verifizierung gebaut, aber nicht
// bedienbar — sie war deshalb seit dem ersten Prüfbericht als „offen"
// vermerkt, obwohl der Code fertig ist.
//
// Dieses Skript setzt den Anspruch im EMULATOR. Es fasst die echte
// Anmeldung nie an: Ohne `FIREBASE_AUTH_EMULATOR_HOST` bricht es ab, statt
// sich mit der Produktion zu verbinden.
//
// AUFRUF — bei laufendem `npm run dev:lokal`, in einem zweiten Terminal:
//     node scripts/dev-moderator.mjs deine@mail.de
//
// Danach in der App abmelden und neu anmelden: Ansprüche stehen im Token,
// und das wird erst bei der nächsten Anmeldung neu ausgestellt.
// ═══════════════════════════════════════════════════════════════════════════

const HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PROJEKT = process.env.GCLOUD_PROJECT ?? 'demo-klar';

if (!PROJEKT.startsWith('demo-')) {
  console.error(
    `Abbruch: Projekt "${PROJEKT}" ist kein Emulatorprojekt.\n` +
    'Dieses Skript ist ausschliesslich fuer den lokalen Betrieb gedacht.',
  );
  process.exit(1);
}

const mail = process.argv[2];
if (!mail) {
  console.error('Aufruf: node scripts/dev-moderator.mjs <e-mail>');
  process.exit(1);
}

const basis = `http://${HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJEKT}`;

async function hole(pfad, init) {
  const r = await fetch(basis + pfad, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${pfad} → HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

try {
  const { users = [] } = await hole('/accounts:query', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const treffer = users.find((u) => (u.email ?? '').toLowerCase() === mail.toLowerCase());
  if (!treffer) {
    console.error(
      `Kein Konto mit "${mail}" im Emulator.\n` +
      `Vorhanden: ${users.map((u) => u.email || u.localId).join(', ') || '(keins)'}\n` +
      'Zuerst in der App registrieren, dann dieses Skript erneut aufrufen.',
    );
    process.exit(1);
  }

  await hole('/accounts:update', {
    method: 'POST',
    body: JSON.stringify({
      localId: treffer.localId,
      customAttributes: JSON.stringify({ moderator: true }),
    }),
  });

  console.log(`Moderator-Anspruch gesetzt fuer ${mail} (${treffer.localId}).`);
  console.log('Jetzt in der App abmelden und neu anmelden — sonst traegt das Token ihn noch nicht.');
} catch (e) {
  console.error('Fehlgeschlagen:', e.message);
  console.error('Laeuft `npm run dev:lokal` in einem anderen Terminal?');
  process.exit(1);
}
