#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EINMALIGER UMBAU: `&&`-Schutz -> Ternaer in firestore.rules
//
// ── WARUM EIN SKRIPT UND KEINE FERTIGE DATEI ──────────────────────────────
// Die uebliche Regel in diesem Projekt lautet: vollstaendige Dateien liefern,
// keine Patcher. Hier ist sie nachweislich das groessere Risiko.
//
// Am 14.08.2026 zeigte die Pruefsumme, dass die firestore.rules im Repository
// von der in der Arbeitskopie ABWEICHT (d66b5062… gegen e832dac6…) und einen
// aelteren Stand traegt. Eine vollstaendige Datei haette diesen Unterschied
// stillschweigend ueberschrieben — und das faellt niemandem auf, weil die
// Datei danach vollstaendig AUSSIEHT. Derselbe Fehler wie beim `git rm` am
// 13.08. und bei `check:startlast`.
//
// Dieses Skript aendert nur, was es vorher gefunden hat, und bricht ab, wenn
// eine Stelle NICHT GENAU EINMAL vorkommt. Es schreibt nichts auf Verdacht.
//
// ── WAS UMGEBAUT WIRD ─────────────────────────────────────────────────────
//   resource != null && resource.data.x == 1        -> ABSTURZ
//   resource != null ? resource.data.x == 1 : false -> traegt
//
// Firestore wertet bei `&&` beide Seiten aus. Bei `setDoc(…, { merge: true })`
// auf ein noch nicht vorhandenes Dokument wird auch der update-Zweig
// ausgewertet; `resource` ist dann null, und der Zugriff darauf ist kein
// `false`, sondern ein Auswertungsfehler.
//
// Aufruf:  node scripts/regel-ternaer-nachziehen.mjs [Datei]
//          node scripts/regel-ternaer-nachziehen.mjs firestore.rules --probe
//          (--probe zeigt nur an, schreibt nicht)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';

const datei = process.argv[2] || 'firestore.rules';
const nurAnzeigen = process.argv.includes('--probe');

/**
 * Je Stelle: ein Erkennungsmuster ueber den GESAMTEN allow-Ausdruck bis zum
 * Semikolon, und eine Funktion, die daraus die Ternaer-Fassung baut.
 *
 * `[\s\S]*?` statt `.*?`, damit mehrzeilige Ausdruecke mitgenommen werden.
 */
const STELLEN = [
  {
    name: '/users/{userId}  allow update  (REG-01)',
    // `keepsServerFields()` steht im Repository OHNE Argument. Meine
    // Arbeitskopie hatte `(resource)`. Beide Schreibweisen werden akzeptiert;
    // wer nur eine kennt, trifft die Datei nicht.
    muster: /^([ \t]*)allow update:\s*if\s+[\s\S]*?&&\s*isValidUserUpdate\(request\.resource\.data,\s*resource\.data\)\s*&&\s*keepsServerFields\(\s*(?:resource)?\s*\)\s*;/m,
    baue: (treffer, einzug) => {
      const i = treffer.indexOf('&& isValidUserUpdate');
      const vor = treffer.slice(0, i).replace(/[ \t]*$/, '').replace(/\n[ \t]*$/, '');
      const rest = treffer
        .slice(i + 2, treffer.lastIndexOf(';'))
        .split(/\s*&&\s*/)
        .map((t) => t.trim())
        .filter(Boolean);
      const tief = einzug + '              ';
      return (
        vor + '\n' +
        tief + '&& (resource != null\n' +
        tief + '      ? ' + rest[0] + '\n' +
        rest.slice(1).map((t) => tief + '        && ' + t).join('\n') + (rest.length > 1 ? '\n' : '') +
        tief + '      : false);'
      );
    },
  },
  {
    name: '/blocks/{blockId}  allow delete',
    muster: /^([ \t]*)allow delete:\s*if\s+signedIn\(\)\s*&&\s*request\.auth\.uid == resource\.data\.blockerUid\s*;/m,
    baue: (treffer, einzug) => {
      const tief = einzug + '              ';
      return (
        einzug + 'allow delete: if signedIn()\n' +
        tief + '&& (resource != null\n' +
        tief + '      ? request.auth.uid == resource.data.blockerUid\n' +
        tief + '      : false);'
      );
    },
  },
  {
    name: '/chats/{chatId}  allow update',
    muster: /^([ \t]*)allow update:\s*if\s+signedIn\(\)\s*&&\s*request\.auth\.uid in resource\.data\.participants\s*&&\s*isValidChatUpdate\(request\.resource\.data,\s*resource\.data\)\s*;/m,
    baue: (treffer, einzug) => {
      const tief = einzug + '              ';
      return (
        einzug + 'allow update: if signedIn()\n' +
        tief + '&& (resource != null\n' +
        tief + '      ? request.auth.uid in resource.data.participants\n' +
        tief + '        && isValidChatUpdate(request.resource.data, resource.data)\n' +
        tief + '      : false);'
      );
    },
  },
];

let text = readFileSync(datei, 'utf8');
const fehler = [];
const gemacht = [];

console.log(`\nUmbau in ${datei}${nurAnzeigen ? '  (nur Probe, es wird nicht geschrieben)' : ''}\n`);

for (const s of STELLEN) {
  const alle = text.match(new RegExp(s.muster.source, s.muster.flags + 'g'));
  const anzahl = alle ? alle.length : 0;

  if (anzahl === 0) {
    // Schon umgebaut? Dann ist das kein Fehler.
    fehler.push(`${s.name}: NICHT GEFUNDEN (0 Treffer)`);
    console.log(`  ?  ${s.name}\n     nicht gefunden`);
    continue;
  }
  if (anzahl > 1) {
    fehler.push(`${s.name}: ${anzahl} Treffer — mehrdeutig, nichts geaendert`);
    console.log(`  !  ${s.name}\n     ${anzahl} Treffer, mehrdeutig`);
    continue;
  }

  const m = text.match(s.muster);
  const vorher = m[0];
  const nachher = s.baue(m[0], m[1]);
  text = text.replace(vorher, nachher);
  gemacht.push(s.name);
  console.log(`  ok ${s.name}`);
  console.log(`     VORHER:\n${vorher.split('\n').map((z) => '       ' + z.trim()).join('\n')}`);
  console.log(`     NACHHER:\n${nachher.split('\n').map((z) => '       ' + z.trim()).join('\n')}\n`);
}

if (fehler.length > 0) {
  console.error(`\nABBRUCH — nichts geschrieben:\n${fehler.map((f) => '  ' + f).join('\n')}\n`);
  console.error(`Die Datei weicht von der Erwartung ab. Bitte die Ausgabe zeigen,\n` +
                `statt von Hand nachzuhelfen.\n`);
  process.exit(1);
}

if (nurAnzeigen) {
  console.log(`Probe in Ordnung: ${gemacht.length} Stelle(n) waeren umgebaut worden.\n`);
  process.exit(0);
}

writeFileSync(datei, text);
console.log(`${gemacht.length} Stelle(n) umgebaut. ${datei} geschrieben.\n`);
