#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ist in `dist/` ein Emulator-Bau oder ein Produktions-Bau?
//
// ── DER ANLASS VOM 14.08.2026 ─────────────────────────────────────────────
// `npm run build && npm run start` lief zum ersten Mal — und der Server sagte
// sofort:
//
//   WARNUNG: Weder Emulator noch Projekt-ID. Firebase Admin hat keine
//   Zugangsdaten — jeder Firestore-Zugriff wird scheitern.
//
// Im Browser folgte daraus „Forbidden: Invalid token" an der Altersabfrage.
// Kein Fehler im Code: Es gab schlicht KEINEN Weg, die gebaute App lokal zu
// betreiben. `dev:lokal` startet den Emulator, aber mit Vite. `start` nimmt
// die gebauten Dateien, aber ohne Emulator. Die Kombination fehlte — und
// deshalb hat den Build monatelang niemand ausprobiert.
//
// ── WARUM DIESE MARKIERUNG NOETIG IST ─────────────────────────────────────
// Der Client liest `import.meta.env.VITE_EMULATOR` — und das wird BEIM BAUEN
// eingebacken, nicht beim Starten. Ein Bau mit `VITE_EMULATOR=true` zeigt
// dauerhaft auf `localhost`; ein Bau ohne zeigt auf das echte Projekt.
//
// Beide Baeuge landen in `dist/` und sehen gleich aus. Wer den falschen
// ausliefert, merkt es erst, wenn niemand sich anmelden kann — oder,
// schlimmer, wenn echte Daten an einen Emulator gehen, den es dort nicht
// gibt.
//
// Deshalb hinterlaesst `build:lokal` eine Marke, und beide Startbefehle
// pruefen sie:
//
//   npm run start         verlangt: KEINE Marke  (Produktions-Bau)
//   npm run start:lokal   verlangt: Marke        (Emulator-Bau)
//
// Aufruf:  node scripts/baustand.mjs markiere|entferne|pruefe|verlange
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

const MARKE = 'dist/EMULATOR-BAU';
const modus = process.argv[2] ?? '';

/** Kein Datum im Inhalt: Der Text soll sich zwischen Baeugen nicht aendern. */
const INHALT = [
  'Dieser Ordner enthaelt einen EMULATOR-Bau.',
  '',
  'Er wurde mit VITE_EMULATOR=true gebaut und zeigt damit dauerhaft auf',
  'localhost. Er darf NICHT ausgeliefert werden.',
  '',
  'Fuer einen Produktions-Bau:  npm run build',
  '',
].join('\n');

function markiere() {
  mkdirSync('dist', { recursive: true });
  writeFileSync(MARKE, INHALT);
  console.log(`\n  ${MARKE} angelegt — dieser Bau zeigt auf den Emulator.\n`);
}

function entferne() {
  rmSync(MARKE, { force: true });
  console.log(`\n  Produktions-Bau. (${MARKE} entfernt, falls vorhanden.)\n`);
}

function pruefe() {
  if (!existsSync(MARKE)) return;
  console.error([
    '',
    'ABBRUCH: In dist/ liegt ein EMULATOR-Bau.',
    '',
    'Er wurde mit VITE_EMULATOR=true gebaut und zeigt auf localhost. Ihn mit',
    '`npm run start` zu starten ergibt eine App, die sich mit nichts verbinden',
    'kann — und ausgeliefert waere er ein Ausfall ohne Fehlermeldung.',
    '',
    'Gemeint war vermutlich einer von beiden:',
    '',
    '    npm run start:lokal    diesen Bau gegen den Emulator starten',
    '    npm run build          neu bauen, fuer die Produktion',
    '',
  ].join('\n'));
  process.exit(1);
}

function verlange() {
  if (existsSync(MARKE)) return;
  console.error([
    '',
    'ABBRUCH: In dist/ liegt KEIN Emulator-Bau.',
    '',
    '`start:lokal` startet den Emulator. Ein Produktions-Bau zeigt aber auf',
    'das echte Firebase-Projekt und wuerde den Emulator ignorieren — die',
    'Anmeldung ginge an die echte Anlage, waehrend der Server lokal antwortet.',
    'Das sieht aus wie ein Fehler im Code und ist keiner.',
    '',
    'Zuerst:',
    '',
    '    npm run build:lokal',
    '',
  ].join('\n'));
  process.exit(1);
}

const wege = { markiere, entferne, pruefe, verlange };
const weg = wege[modus];
if (!weg) {
  console.error(`\nUnbekannter Modus: ${JSON.stringify(modus)}\n` +
                `Moeglich: ${Object.keys(wege).join(', ')}\n`);
  process.exit(1);
}
weg();
