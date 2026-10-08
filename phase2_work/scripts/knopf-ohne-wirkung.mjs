#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Schaltflaechen, die nichts tun.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// In `Profile.tsx` stand am Fuss der Klar+-Vergleichstabelle:
//
//     <button className="w-full mt-5 py-3 bg-brand …">
//       <Sparkles size={16} />
//       Klar+ entdecken
//     </button>
//
// Kein `onClick`, kein `type="submit"`, kein `form`. Der Knopf sah aus wie
// der Weg zum Abo, hob sich farblich vom Rest ab, war 44 px hoch — und tat
// beim Antippen nichts. Dieselbe Bauform gab es laut `klar/17` schon einmal
// bei den Rechtstexten (DSG-02): „Schaltflaechen ohne `onClick`".
//
// ── WARUM DAS SCHLIMMER IST ALS EIN FEHLER ────────────────────────────────
// Ein Knopf, der eine Fehlermeldung zeigt, ist eine Auskunft. Ein Knopf, der
// nichts tut, ist keine — der Mensch davor haelt es fuer sein eigenes
// Vertun und tippt noch dreimal. Bei einer App, die „Klar" heisst, ist das
// die teuerste Art von Fehler.
//
// ── WIE GEPRUEFT WIRD ─────────────────────────────────────────────────────
// Ein `<button>` gilt als wirksam, wenn eines zutrifft:
//   · `onClick`, `onPointerDown`, `onMouseDown`, `onKeyDown`, `onTouchEnd`
//   · `type="submit"` oder `type="reset"` oder `form=…`
//   · `disabled` (dann ist die Wirkungslosigkeit die Absicht)
//   · `{...irgendwas}` in den Eigenschaften — die Wirkung kann von aussen
//     kommen, und was von aussen kommt, sieht eine Textsuche nicht
//
// Das Ende des Eigenschaftsbereichs wird mit demselben kleinen Leser
// gesucht wie in `check-beschriftung.mjs`: Er zaehlt geschweifte Klammern
// und ueberspringt Zeichenketten. Eine naive Suche nach dem ersten `>`
// haette an jedem `onClick={() => …}` abgebrochen — genau der Fehler, der
// dort am 12.08.2026 57 von 90 Faellen verdeckt hat.
//
// ── WAS DIESE PRUEFUNG NICHT SIEHT ────────────────────────────────────────
// · Einen `onClick`, dessen Rumpf leer ist: `onClick={() => {}}`.
// · Einen Klickfaenger auf einem umgebenden Element.
// · Ein `<div role="button">` — hier zaehlen nur echte `<button>`.
// Deshalb eine Obergrenze statt Nulltoleranz: Sie haelt den Stand fest, und
// jeder NEUE wirkungslose Knopf laesst `verify` fehlschlagen.
//
// Aufruf:  node scripts/knopf-ohne-wirkung.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

function ohneKommentare(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);
}

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx$/.test(p) && !/\.(test|spec)\.tsx$/.test(p)) aus.push(p);
  }
  return aus;
}

/** Ende des Attributbereichs. Zaehlt Klammern, ueberspringt Zeichenketten. */
function endeDerAttribute(text, start) {
  let i = start, klammern = 0, anfuehrung = null;
  while (i < text.length) {
    const z = text[i];
    if (anfuehrung) {
      if (z === '\\') { i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++; continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; i++; continue; }
    if (z === '{') { klammern++; i++; continue; }
    if (z === '}') { klammern--; i++; continue; }
    if (z === '>' && klammern === 0) return i;
    i++;
  }
  return -1;
}

const WIRKUNG = /\bon(Click|PointerDown|MouseDown|KeyDown|TouchEnd|Submit)\s*=/;
const ABSICHT = /\bdisabled\b|\bform\s*=|\btype\s*=\s*["'](submit|reset)["']/;
const VON_AUSSEN = /\{\s*\.\.\./;

const proDatei = new Map();
let gesamt = 0;

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));

  for (const m of text.matchAll(/<button\b/g)) {
    const ende = endeDerAttribute(text, m.index + m[0].length);
    if (ende === -1) continue;
    const attribute = text.slice(m.index + m[0].length, ende);
    if (WIRKUNG.test(attribute)) continue;
    if (ABSICHT.test(attribute)) continue;
    if (VON_AUSSEN.test(attribute)) continue;

    gesamt++;
    const zeile = text.slice(0, m.index).split('\n').length;
    if (!proDatei.has(datei)) proDatei.set(datei, []);
    proDatei.get(datei).push(zeile);
  }
}

const sortiert = [...proDatei.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\nSchaltflaechen ohne erkennbare Wirkung: ${gesamt} in ${proDatei.size} Dateien — erlaubt sind ${obergrenze}.\n`);
for (const [datei, zeilen] of sortiert) {
  console.log(`  ${String(zeilen.length).padStart(3)}  ${datei}  (Zeilen ${zeilen.slice(0, 6).join(', ')}${zeilen.length > 6 ? ', …' : ''})`);
}

if (gesamt > obergrenze) {
  console.log(`
Ein Knopf ohne Wirkung ist schlimmer als einer mit Fehlermeldung: Wer ihn
antippt, haelt das Ausbleiben fuer sein eigenes Vertun. Richtig ist eines
von dreien — ein \`onClick\`, ein \`type="submit"\`, oder \`disabled\` mit
einem Satz daneben, warum.
`);
  process.exit(1);
}
console.log('');
