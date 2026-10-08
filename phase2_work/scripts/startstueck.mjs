#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Woraus das Startstueck besteht.
//
// ── DER ANLASS ────────────────────────────────────────────────────────────
// Nach der `lazy`-Umstellung (ebd803c) wiegt `dist/assets/index-*.js`
// 1.339,65 kB (378,61 kB gzip). Die Bildschirme sind draussen, die schweren
// Pakete auch — jspdf, recharts, html2canvas liegen in eigenen Stuecken.
//
// Was UEBRIG ist, war eine Vermutung: „vermutlich firebase/firestore". Eine
// Vermutung ist keine Grundlage fuer einen Umbau am AuthContext, der die
// Stelle ist, an der Anmeldung, Profil und Gate zusammenlaufen.
//
// Dieses Skript ersetzt die Vermutung durch eine Rechnung. Die Rechnung
// selbst steht in `scripts/quellkarte.mjs` und ist geprueft
// (tests/quellkarte.spec.ts, 9 Faelle).
//
// ── VORAUSSETZUNG ─────────────────────────────────────────────────────────
// Ein Bau MIT Quellkarten:
//
//     npx vite build --sourcemap
//
// Ohne `--sourcemap` gibt es keine `.map`-Datei, und dieses Skript sagt das,
// statt eine Zahl zu erfinden.
//
// ── GENAUIGKEIT, ehrlich ──────────────────────────────────────────────────
// Gezaehlt werden Bytes im UNKOMPRIMIERTEN Ergebnis. Nach gzip verschieben
// sich die Anteile; wiederholte Zeichenketten sind dort billiger. Die
// REIHENFOLGE der Verursacher bleibt aussagekraeftig — und die ist die
// Frage.
//
// Aufruf:  node scripts/startstueck.mjs [Anzahl Zeilen]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nachGruppen, verteileBytes } from './quellkarte.mjs';

const anzahl = Number(process.argv[2] ?? 25);
const ORDNER = 'dist/assets';

if (!existsSync(ORDNER)) {
  console.log(`\nEs gibt kein ${ORDNER}. Erst bauen:\n\n    npx vite build --sourcemap\n`);
  process.exit(1);
}

const dateien = readdirSync(ORDNER);
const stueck = dateien.find((d) => /^index-.*\.js$/.test(d));
if (!stueck) {
  console.log(`\nIn ${ORDNER} steht kein index-*.js. Wurde gebaut?\n`);
  process.exit(1);
}

const karte = `${stueck}.map`;
if (!dateien.includes(karte)) {
  console.log([
    '',
    `Zu ${stueck} gibt es keine Quellkarte (${karte}).`,
    '',
    'Ohne Quellkarte laesst sich nicht sagen, woraus das Stueck besteht —',
    'und geraten wird hier nicht. Noch einmal bauen, diesmal mit:',
    '',
    '    npx vite build --sourcemap',
    '',
  ].join('\n'));
  process.exit(1);
}

const inhalt = readFileSync(join(ORDNER, stueck), 'utf8');
const zeilenlaengen = inhalt.split('\n').map((z) => z.length);
const gesamt = inhalt.length;

const roh = JSON.parse(readFileSync(join(ORDNER, karte), 'utf8'));
const verteilung = verteileBytes(roh.mappings, zeilenlaengen, roh.sources ?? []);
const gruppen = nachGruppen(verteilung);
const zugeordnet = gruppen.reduce((s, g) => s + g.bytes, 0);

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const anteil = (n) => `${((n / gesamt) * 100).toFixed(1)} %`;

console.log(`\n── WORAUS ${stueck} BESTEHT ${'─'.repeat(Math.max(0, 40 - stueck.length))}`);
console.log(`\n  Gesamt: ${kb(gesamt)} (unkomprimiert), ${roh.sources?.length ?? 0} Quellen.`);
if (zugeordnet !== gesamt) {
  console.log(`  Zugeordnet: ${kb(zugeordnet)} — Differenz ${kb(gesamt - zugeordnet)} (Zeilenumbrueche).`);
}
console.log('');

for (const g of gruppen.slice(0, anzahl)) {
  console.log(`  ${kb(g.bytes).padStart(9)}  ${anteil(g.bytes).padStart(7)}   ${g.name}`);
}
if (gruppen.length > anzahl) {
  const rest = gruppen.slice(anzahl).reduce((s, g) => s + g.bytes, 0);
  console.log(`  ${kb(rest).padStart(9)}  ${anteil(rest).padStart(7)}   … und ${gruppen.length - anzahl} weitere`);
}
console.log('');
