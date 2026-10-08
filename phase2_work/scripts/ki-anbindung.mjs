#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Zählt, wie viele KI-Endpunkte in `server.ts` über `kiAufruf.ts` laufen.
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Es gibt drei Zustände, und der Unterschied ist keine Formsache:
//
//   voll (`beantworte`)  Zeitgrenze, zweiter Versuch, JSON-Prüfung, und im
//                        Ausfall die in `kiPolitik.ts` hinterlegte Strategie
//                        MIT Kennzeichnung der Herkunft.
//   halb (`ausfall`)     Nur der Ausfallpfad ist richtig. Keine Zeitgrenze,
//                        kein zweiter Versuch. Eine hängende Anfrage hängt.
//   ohne                 Der `catch`-Zweig entscheidet selbst — meist mit
//                        HTTP 200 und einem erfundenen Text.
//
// Diese Zahl stand in den Berichten mehrfach als Schätzung („etwa 38").
// Sie kommt jetzt von hier.
//
// ── UND EINE KORREKTUR AN DIESER STELLE ───────────────────────────────────
// Die erste Fassung dieses Skripts suchte nach dem Wort `beantworte(` und
// zählte damit die Kommentare mit, in denen „UMGESTELLT … auf
// kiAufruf.beantworte()" steht — und zwar für den Endpunkt DARÜBER, weil
// solche Kommentare vor dem nächsten `app.post` stehen. Gemeldet: 12 voll
// angebundene Endpunkte. Tatsächlich: 8.
//
// Das ist derselbe Fehler wie bei `klar_contacts_left`, bei `QuickThemeToggle`
// und bei `@ts-nocheck`: **Ein Zähler, der Kommentare mitzählt, erzeugt
// Befunde, die keine sind.** Diesmal in die andere Richtung — er hat Arbeit
// als erledigt gemeldet, die nicht erledigt war.
//
// ── GRENZE DIESER MESSUNG ─────────────────────────────────────────────────
// Ein Endpunkt gilt als „ab hier bis zum nächsten `app.post/get/...`".
// Kommentare werden vorher entfernt — sonst zählt ein Kommentar, in dem das
// Wort `beantworte` vorkommt, für den Endpunkt DARÜBER mit. Genau das ist
// beim ersten Lauf am 12.08.2026 passiert und hat die Zahl um eins verfälscht.
//
// Aufruf:  node scripts/ki-anbindung.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const roh = readFileSync('server.ts', 'utf8');

// Kommentare durch Leerzeilen ersetzen, damit die Zeilennummern stimmen.
const text = roh
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);

const zeilen = text.split('\n');

const anfaenge = [];
zeilen.forEach((z, i) => {
  const m = z.match(/app\.(get|post|put|delete)\(\s*["'`]([^"'`]+)/);
  if (m) anfaenge.push({ zeile: i, pfad: m[2] });
});

const voll = [];
const halb = [];
const ohne = [];

for (let k = 0; k < anfaenge.length; k++) {
  const von = anfaenge[k].zeile;
  const bis = k + 1 < anfaenge.length ? anfaenge[k + 1].zeile : zeilen.length;
  const block = zeilen.slice(von, bis).join('\n');
  if (!/ai\.models\.generateContent/.test(block)) continue;
  const eintrag = { pfad: anfaenge[k].pfad, zeile: von + 1 };
  // Gesucht wird der AUFRUF, nicht das Wort: `await beantworte(` und
  // `= ausfall(`. In Kommentaren steht „kiAufruf.beantworte()" ohne `await`
  // — das zaehlt damit nicht mit, auch wenn die Kommentarentfernung darueber
  // einmal versagen sollte. Zwei Sicherungen fuer denselben Fehler.
  if (/await\s+beantworte\(/.test(block)) voll.push(eintrag);
  else if (/=\s*ausfall\(/.test(block)) halb.push(eintrag);
  else ohne.push(eintrag);
}

const gesamt = voll.length + halb.length + ohne.length;
console.log(`\nKI-Endpunkte in server.ts: ${gesamt}\n`);
console.log(`  voller Weg (beantworte):      ${String(voll.length).padStart(3)}`);
console.log(`  Zwischenstufe (nur ausfall):  ${String(halb.length).padStart(3)}`);
console.log(`  ohne jede Anbindung:          ${String(ohne.length).padStart(3)}`);

if (ohne.length > 0) {
  console.log('\n── ohne jede Anbindung ──────────────────────────────────────');
  for (const e of ohne) console.log(`  ${String(e.zeile).padStart(5)}  ${e.pfad}`);
}
if (halb.length > 0) {
  console.log('\n── nur ausfall (kein Zeitlimit, kein zweiter Versuch) ───────');
  for (const e of halb) console.log(`  ${String(e.zeile).padStart(5)}  ${e.pfad}`);
}
console.log('');
