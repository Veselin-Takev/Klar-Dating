#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Zugriff auf `resource`, wenn es das Dokument noch nicht gibt.
//
// ── DER BEFUND, den diese Pruefung festhaelt ───────────────────────────────
// Am 14.08.2026 kostete ein einziger Fall drei Anlaeufe im Emulator:
//
//   allow update: if … && isValidUserUpdate(request.resource.data, resource.data)
//
// Bei `setDoc(ref, {...}, { merge: true })` auf ein Dokument, das es NOCH
// NICHT GIBT, wertet Firestore auch den update-Zweig aus. `resource` ist dann
// `null`, und der Zugriff darauf ist kein „false" — er ist ein AUSWERTUNGS-
// FEHLER. Die Anfrage scheitert mit einer Meldung, die nach Berechtigung
// aussieht und keine ist.
//
// ── WARUM `&&` NICHT SCHUETZT ─────────────────────────────────────────────
// Der naheliegende Schutz funktioniert nicht:
//
//   resource != null && resource.data.x == 1        -> ABSTURZ
//   resource != null ? resource.data.x == 1 : false -> traegt
//
// Firestore wertet bei `&&` beide Seiten aus. Nur der Ternaer wertet die
// rechte Seite wirklich bedingt aus. Genau diese Verwechslung liess zwei
// fruehere Reparaturversuche wirkungslos (tests/rules-sprache.spec.ts).
//
// ── WAS GEPRUEFT WIRD, UND WAS NICHT ──────────────────────────────────────
// Gezaehlt werden nur SCHREIBENDE Regeln: update, write, delete. Nur dort
// entsteht der Fall „Dokument gibt es noch nicht, Zweig wird trotzdem
// ausgewertet".
//
// Lesende Regeln (`read`, `get`, `list`) lesen `resource` ebenfalls
// ungeschuetzt — dort ist die Wirkung aber eine andere: Ein `get` auf ein
// nicht vorhandenes Dokument wuerde ohnehin nichts liefern. Der Unterschied
// ist die Fehlermeldung, nicht das Ergebnis. Sie stehen bewusst NICHT in
// dieser Zaehlung; wer sie mitzaehlen will, setzt --auch-lesend.
//
// Aufruf:  node scripts/regel-nullzugriff.mjs [Datei] [Obergrenze] [--auch-lesend]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const datei = process.argv[2] || 'firestore.rules';
const obergrenze = Number(process.argv[3] ?? 0);
const auchLesend = process.argv.includes('--auch-lesend');

const SCHREIBEND = ['update', 'write', 'delete'];

/** Zeilenkommentare entfernen, Zeilennummern erhalten. */
function ohneKommentare(text) {
  return text
    .split('\n')
    .map((z) => {
      const i = z.indexOf('//');
      return i === -1 ? z : z.slice(0, i);
    })
    .join('\n');
}

const roh = readFileSync(datei, 'utf8');
const txt = ohneKommentare(roh);

const regeln = [];
const suche = /allow\s+([a-z, ]+):/g;
let m;
while ((m = suche.exec(txt)) !== null) {
  const start = m.index;
  const ende = txt.indexOf(';', start);
  if (ende === -1) continue;
  const block = txt.slice(start, ende + 1).split(/\s+/).join(' ');
  const zeile = txt.slice(0, start).split('\n').length;
  const ops = m.group ? m.group(1) : m[1];
  regeln.push({ zeile, ops: ops.trim(), block });
}

const treffer = [];
for (const r of regeln) {
  // `request.resource` ist die EINGEHENDE Schreibung und immer vorhanden.
  // Nur das nackte `resource` meint das bestehende Dokument.
  const b = r.block.split('request.resource').join('@');
  if (!b.includes('resource')) continue;

  const ops = r.ops.split(',').map((o) => o.trim());
  const schreibend = ops.some((o) => SCHREIBEND.includes(o));
  if (!schreibend && !auchLesend) continue;

  const geschuetzt = b.includes('resource != null') && b.includes('?');
  if (geschuetzt) continue;

  treffer.push({ ...r, schreibend });
}

console.log(`\nRegeln, die \`resource\` ohne Ternaer-Schutz lesen: ${treffer.length} — erlaubt sind ${obergrenze}.`);
console.log(`(${regeln.length} allow-Regeln in ${datei} geprueft${auchLesend ? ', lesende eingeschlossen' : ', nur schreibende'}.)\n`);

for (const t of treffer) {
  console.log(`  Zeile ${String(t.zeile).padStart(4)}  allow ${t.ops}`);
  console.log(`        ${t.block.slice(0, 150)}${t.block.length > 150 ? '…' : ''}`);
}

if (treffer.length > obergrenze) {
  console.log(`
Firestore wertet bei \`&&\` BEIDE Seiten aus. Der Schutz muss ein Ternaer sein:

    allow update: if signedIn()
                  && (resource != null
                        ? request.auth.uid in resource.data.participants
                        : false);

Sonst scheitert jedes \`setDoc(..., { merge: true })\` auf ein noch nicht
vorhandenes Dokument mit einem Auswertungsfehler — und der sieht aus wie ein
Berechtigungsproblem.
`);
  process.exit(1);
}
console.log('');
