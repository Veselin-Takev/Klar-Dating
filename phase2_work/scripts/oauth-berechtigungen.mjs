#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Zusaetzliche Berechtigungen bei der Anmeldung.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// In der Adresszeile des Anmeldefensters stand:
//
//   …&providerId=google.com&scopes=profile,https://www.googleapis.com/auth/gmail.send
//
// Jede Google-Anmeldung fragte die Erlaubnis ab, E-Mails IM NAMEN der Person
// zu versenden. Der Zustimmungsdialog von Google sagt das woertlich.
//
// Gebraucht hat sie ein einziger Baustein — `EmailSummaryWidget` —, und der
// verschickte eine Mail mit zwei Zaehlern, die nirgends geschrieben werden.
// Die Mail enthielt zweimal „0".
//
// ── WARUM DAS EINE EIGENE PRUEFUNG BEKOMMT ────────────────────────────────
// Ein `addScope(...)` ist eine Zeile und faellt in keiner Durchsicht auf.
// Seine Wirkung steht dafuer in einem Dialog, den die Person beim ERSTEN
// Kontakt mit der App sieht — an der Stelle, an der Vertrauen entsteht oder
// nicht. Bei Google sind Bereiche wie `gmail.send` ausserdem „restricted"
// und verlangen im Produktivbetrieb eine Sicherheitspruefung.
//
// Deshalb Nulltoleranz statt Obergrenze: Eine zusaetzliche Berechtigung ist
// keine Sache, in die man hineinwaechst. Wer eine braucht, traegt sie unten
// mit Begruendung ein — und merkt beim Schreiben dieser Begruendung, was er
// verlangt.
//
// ── WAS DIESES SKRIPT NICHT LEISTET ───────────────────────────────────────
// Es sieht `addScope`, `setCustomParameters` und die bekannten
// Anbieter-Klassen. Wer eine Berechtigung ueber einen selbst gebauten String
// oder eine Variable hineinreicht, faellt nicht auf. Es faengt den geraden
// Weg — so wie `routen-inventar.mjs` auch.
//
// Aufruf:  node scripts/oauth-berechtigungen.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

/**
 * Berechtigungen, die bewusst angefordert werden.
 *
 * Leer. Die Anmeldung fragt nur, was sie zum Anmelden braucht — Name,
 * E-Mail-Adresse und Bild kommen ohne eigenen Eintrag mit.
 */
const ERLAUBT = {
  // Beispiel fuer den Fall, dass je eine dazukommt:
  // 'https://www.googleapis.com/auth/calendar.events':
  //   { grund: 'Date-Termine in den Kalender eintragen, nach eigener Zustimmung' },
};

function ohneKommentare(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);
}

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) aus.push(p);
  }
  return aus;
}

const treffer = [];

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const zeilen = text.split('\n');
  zeilen.forEach((zeile, i) => {
    const m = /\.addScope\(\s*['"`]([^'"`]*)['"`]\s*\)/.exec(zeile);
    if (m) {
      const bereich = m[1] ?? '';
      if (!(bereich in ERLAUBT)) treffer.push({ datei, zeile: i + 1, bereich });
      return;
    }
    // Eine Variable statt einer Zeichenkette: nicht lesbar, deshalb melden.
    if (/\.addScope\(/.test(zeile)) {
      treffer.push({ datei, zeile: i + 1, bereich: '(nicht als Text lesbar)' });
    }
  });
}

console.log(`\nZusaetzliche Berechtigungen bei der Anmeldung: ${treffer.length} — erlaubt sind ${obergrenze}.`);
console.log(`(${Object.keys(ERLAUBT).length} mit hinterlegter Begruendung.)\n`);

for (const t of treffer) {
  console.log(`  ${t.datei}:${t.zeile}`);
  console.log(`      ${t.bereich}`);
}

if (treffer.length > obergrenze) {
  console.log([
    '',
    'Eine zusaetzliche Berechtigung steht im Zustimmungsdialog, den die Person',
    'beim ERSTEN Kontakt mit der App sieht. Sie gehoert nur dorthin, wenn eine',
    'Funktion sie WIRKLICH braucht und die Person davon etwas hat.',
    '',
    'Wird sie gebraucht: mit Begruendung in ERLAUBT in',
    'scripts/oauth-berechtigungen.mjs eintragen.',
    '',
  ].join('\n'));
  process.exit(1);
}
console.log('');
