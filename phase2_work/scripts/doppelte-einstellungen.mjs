#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Findet Einstellungen, die an mehr als einer Stelle GESCHRIEBEN werden.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// „Haptisches Feedback" stand zweimal auf der Profilseite: einmal als
// `<HapticSettings />`, einmal als zweite, in `Profile.tsx` selbst gebaute
// Bedienung. Beide schrieben `localStorage['klar_haptic_intensity']`, hielten
// den Wert aber in GETRENNTEN React-Zuständen. Wer oben „Stark" wählte, sah
// unten weiterhin den alten Wert — bis zum Neuladen.
//
// Das ist kein Layout-Thema. Zwei Bedienelemente für dieselbe Einstellung
// können sich widersprechen, und die lesende Person hat keine Möglichkeit zu
// erkennen, welches gilt.
//
// ── WAS DIESES SKRIPT FINDET ──────────────────────────────────────────────
// Jeden Aufruf `localStorage.setItem('schluessel', …)` mit einem festen
// Schlüssel, gruppiert nach Schlüssel. Steht ein Schlüssel in mehr als einer
// Datei, ist das ein Hinweis auf genau dieses Muster.
//
// ── WAS EIN FUND NICHT BEWEIST ────────────────────────────────────────────
// Zwei Dateien können denselben Schlüssel aus gutem Grund schreiben — etwa
// eine Migration alter Werte, oder ein Zurücksetzen beim Abmelden. Ein Fund
// ist ein Hinweis, kein Urteil. Deshalb gibt es eine Obergrenze statt einer
// Nulltoleranz: Sie hält den heutigen Stand fest, und jede NEUE Doppelung
// fällt auf.
//
// ── WAS ES NICHT FINDET (bewusst benannt) ─────────────────────────────────
// · Schlüssel, die aus einer Variablen kommen (`setItem(schluessel, …)`).
// · Einstellungen in Firestore statt im localStorage — dort liegt die
//   naechste Doppelung: `SmartPauseWidget` schreibt lokal,
//   `SmartPausePlanner` nach `users/{uid}.userSettings`. Das findet dieses
//   Skript NICHT, und das steht hier, damit die Zahl nicht fuer mehr
//   gehalten wird, als sie ist.
//
// Aufruf:  node scripts/doppelte-einstellungen.mjs [Wurzel] [Obergrenze]
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
    else if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) aus.push(p);
  }
  return aus;
}

/** Schlüssel -> Menge der Dateien, die ihn schreiben. */
const schreiber = new Map();

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  for (const m of text.matchAll(/localStorage\.setItem\(\s*['"`]([^'"`]+)['"`]/g)) {
    const schluessel = m[1];
    if (!schreiber.has(schluessel)) schreiber.set(schluessel, new Set());
    schreiber.get(schluessel).add(datei);
  }
}

const doppelt = [...schreiber.entries()]
  .filter(([, dateien]) => dateien.size > 1)
  .sort((a, b) => b[1].size - a[1].size);

// GEZAEHLT WIRD NICHT DIE ZAHL DER SCHLUESSEL, SONDERN DIE DER UEBERZAEHLIGEN
// SCHREIBSTELLEN: je Schluessel `Dateien - 1`.
//
// BEFUND AN MIR SELBST, 14.08.2026: Die erste Fassung zaehlte die betroffenen
// SCHLUESSEL (18). In der Gegenprobe — eine dritte Schreibstelle fuer einen
// bereits doppelten Schluessel eingebaut — blieb die Zahl bei 18, und die
// Pruefung meldete nichts. Eine Sperrklinke, die eine hinzugekommene
// Doppelung nicht sieht, ist keine.
// Mit dieser Zaehlweise steigt sie von 27 auf 28, und die Pruefung faellt.
const ueberzaehlig = doppelt.reduce((summe, [, wo]) => summe + wo.size - 1, 0);

console.log(
  `\nUeberzaehlige Schreibstellen fuer dieselbe Einstellung: ${ueberzaehlig} — erlaubt sind ${obergrenze}.`,
);
console.log(`Betroffene Schluessel: ${doppelt.length}\n`);
for (const [schluessel, wo] of doppelt) {
  console.log(`  ${schluessel}  (${wo.size} Dateien)`);
  for (const d of [...wo].sort()) console.log(`      ${d}`);
}

if (ueberzaehlig > obergrenze) {
  console.log(`
Zwei Bedienelemente fuer dieselbe Einstellung koennen sich widersprechen:
Sie halten getrennte Zustaende und gleichen sich erst beim Neuladen ab.
Eine Einstellung gehoert an EINEN Ort. Siehe klar/27-profilseite-layout.
`);
  process.exit(1);
}
console.log('');
