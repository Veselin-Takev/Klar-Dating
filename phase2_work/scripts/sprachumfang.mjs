#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Wie viel Text steckt fest verdrahtet in der Oberfläche?
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Vor jeder Entscheidung über Mehrsprachigkeit steht eine Zahl, die bisher
// niemand hatte: Wie viele deutsche Textstellen liegen direkt im Code und
// müssten in eine Sprachdatei wandern? Ohne diese Zahl ist jede Aussage zum
// Aufwand geraten.
//
// ── WAS GEZÄHLT WIRD ──────────────────────────────────────────────────────
// Zeichenketten in `.tsx`-Dateien, die
//   · mindestens zwei Wörter enthalten (ein Wort ist meist ein Bezeichner),
//   · mindestens einen Buchstaben und ein Leerzeichen haben,
//   · nicht wie CSS, ein Pfad, eine URL oder ein Bezeichner aussehen.
// Zusätzlich der sichtbare Text zwischen JSX-Tags.
//
// ── WAS NICHT GEZÄHLT WIRD (bewusst benannt) ──────────────────────────────
// · `src/server/**` — Servertexte, darunter `kuratiert.ts`. Sie brauchen
//   ebenfalls Übersetzungen, sind aber ein eigener Posten.
// · Rechtstexte. Die gehören nicht maschinell übersetzt (siehe Bericht).
// · Kommentare — sie werden vorher entfernt.
// Die Zahl ist eine Grössenordnung, keine Stückliste.
//
// Aufruf:  node scripts/sprachumfang.mjs [Wurzel]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';

function ohneKommentare(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);
}

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) { if (e !== 'server') dateien(p, aus); }
    else if (/\.tsx$/.test(p) && !/\.(test|spec)\.tsx$/.test(p)) aus.push(p);
  }
  return aus;
}

const istOberflaechentext = (s) => {
  const t = s.trim();
  if (t.length < 4) return false;
  if (!/\s/.test(t)) return false;                 // ein Wort -> meist Bezeichner
  if (!/[A-Za-zÄÖÜäöüß]/.test(t)) return false;
  if (/^https?:|^\/|^\.\.?\//.test(t)) return false;      // URL oder Pfad
  if (/[:;]\s*[-\d]|rounded-|flex |grid |text-|bg-|dark:|hover:|w-\[|min-w-/.test(t)) return false; // CSS
  if (/^[A-Z_]+(\s+[A-Z_]+)*$/.test(t)) return false;     // KONSTANTEN
  return true;
};

let gesamt = 0;
const proDatei = [];

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const treffer = new Set();

  for (const m of text.matchAll(/"([^"\\\n]{4,200})"|'([^'\\\n]{4,200})'/g)) {
    const s = m[1] ?? m[2];
    if (istOberflaechentext(s)) treffer.add(s.trim());
  }
  // Sichtbarer Text zwischen Tags: >…<
  for (const m of text.matchAll(/>([^<>{}\n]{4,200})</g)) {
    const s = m[1];
    if (istOberflaechentext(s)) treffer.add(s.trim());
  }

  if (treffer.size > 0) {
    proDatei.push({ datei, n: treffer.size });
    gesamt += treffer.size;
  }
}

proDatei.sort((a, b) => b.n - a.n);

console.log(`\nOberflaechentexte in ${proDatei.length} Dateien unter ${wurzel}/ (ohne server/): ${gesamt}\n`);
console.log('  Die zwoelf groessten:');
for (const e of proDatei.slice(0, 12)) {
  console.log(`  ${String(e.n).padStart(5)}  ${e.datei}`);
}
console.log(`
Grobe Groessenordnung, keine Stueckliste: Der Zaehler kennt keine Bedeutung,
nur Muster. Er ist da, damit die Zahl im Bericht aus einem Skript kommt und
nicht aus einem Gefuehl.
`);
