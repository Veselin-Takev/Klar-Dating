#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Zählt die Kennzahlen, die in den Berichten unter `klar/` stehen.
//
// ── WARUM ES DIESES SKRIPT GIBT ───────────────────────────────────────────
// Am 12.08.2026 standen in drei aufeinanderfolgenden Berichten drei
// verschiedene falsche Zahlen für dieselbe Sache (103, dann 33, richtig 90).
// Jedes Mal war die Ursache dieselbe: ein `grep` von Hand, dessen Treffer
// niemand nachgesehen hat — mal zählte er Dateien statt Fundstellen, mal
// zählte er Kommentare mit, in denen genau die Zeichenkette vorkam, die
// gesucht wurde.
//
// Regel seither: **Keine Kennzahl in einen Bericht, die nicht aus einem
// Skript kommt, das im Repository liegt.** Dieses Skript ist dieses Skript.
//
// ── WIE GEZÄHLT WIRD ──────────────────────────────────────────────────────
// Vor dem Zählen werden aus jeder Datei entfernt:
//   · Blockkommentare `/* … */`
//   · Zeilenkommentare `// …`, sofern sie am Zeilenanfang stehen
//   · Zeichenketten in ' " `
//
// Das ist bewusst grob und darf es sein: Es geht um Grössenordnungen und um
// die Richtung über die Zeit, nicht um die letzte Stelle. Was das Skript
// NICHT kann, steht bei den einzelnen Zahlen dabei.
//
// Aufruf:  node scripts/kennzahlen.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function dateien(verzeichnis, gesammelt = []) {
  for (const name of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      dateien(pfad, gesammelt);
    } else if (/\.tsx?$/.test(pfad)) {
      gesammelt.push(pfad);
    }
  }
  return gesammelt;
}

/**
 * Kommentare und Zeichenketten entfernen.
 *
 * GRENZE: Ein Zeilenkommentar, der hinter Code steht (`const a = 1; // any`),
 * bleibt stehen. Das würde eine Zählung verfälschen, die auf dieses Wort
 * sieht — deshalb wird zusätzlich `//` mitten in der Zeile entfernt, sobald
 * davor kein `:` steht (sonst zerschneidet es `https://`).
 */
function nurCode(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, "''");
}

const wurzeln = ['src'];
if (existsSync('server.ts')) wurzeln.push(null); // server.ts wird einzeln geholt

const dateiliste = dateien('src');
if (existsSync('server.ts')) dateiliste.push('server.ts');

let any = 0;
let asAny = 0;
let leereCatch = 0;
let jsonParse = 0;
let tsNocheck = 0;
const nocheckDateien = [];

for (const pfad of dateiliste) {
  const roh = readFileSync(pfad, 'utf8');
  // `@ts-nocheck` wirkt nur in den ersten Zeilen — dort und nur dort zählen.
  if (/^\s*\/\/\s*@ts-nocheck/m.test(roh.split('\n').slice(0, 3).join('\n'))) {
    tsNocheck++;
    nocheckDateien.push(pfad);
  }
  const code = nurCode(roh);
  asAny += (code.match(/\bas\s+any\b/g) || []).length;
  any += (code.match(/:\s*any\b/g) || []).length;
  leereCatch += (code.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || []).length;
  jsonParse += (code.match(/JSON\.parse\s*\(/g) || []).length;
}

const zeile = (name, wert, hinweis) =>
  `  ${name.padEnd(34)} ${String(wert).padStart(5)}${hinweis ? '   ' + hinweis : ''}`;

console.log(`\nKennzahlen über ${dateiliste.length} Dateien (src/ und server.ts)\n`);
console.log(zeile('Dateien mit @ts-nocheck', tsNocheck));
for (const d of nocheckDateien) console.log(`        ${d}`);
console.log(zeile('`: any`', any, '(Typangaben, nicht Umwandlungen)'));
console.log(zeile('`as any`', asAny));
console.log(zeile('leere catch-Blöcke', leereCatch));
console.log(zeile('JSON.parse-Aufrufe', jsonParse, '(nicht alle sind ungeprüft)'));
console.log(
  '\nHinweis: `JSON.parse` ist keine Fehlerzahl — geprüfte Aufrufe zählen mit.\n' +
    'Die Zahl taugt als Richtung über die Zeit, nicht als Mängelliste.\n',
);
