#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Formularfelder ohne `id` und ohne `name`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Chrome meldet im Reiter „Probleme":
//
//   „A form field element should have an id or name attribute."
//   3 Ressourcen
//
// Gemeldet werden nur die Felder, die gerade auf dem Bildschirm stehen.
// Dieses Skript zaehlt alle — Stand beim Anlegen: 113 in 46 Dateien.
//
// ── WARUM DAS ZAEHLT ──────────────────────────────────────────────────────
// · Das automatische Ausfuellen des Browsers braucht `name` oder `id`, um zu
//   erkennen, worum es geht. Ohne beides bleibt es aus — auch bei gesetztem
//   `autoComplete`.
// · `<label for="…">` kann sich ohne `id` auf nichts beziehen. `aria-label`
//   deckt die Vorlesehilfe ab, aber nicht den Klick auf die Beschriftung.
// · Ein Formular ohne Feldnamen laesst sich nicht auswerten, wenn es einmal
//   ueber ein echtes `<form>` abgeschickt werden soll.
//
// ── WAS DIESES SKRIPT NICHT LEISTET ───────────────────────────────────────
// Es prueft die ANWESENHEIT, nicht die Eindeutigkeit. Zwei Felder mit
// derselben `id` faenden hier nicht auf. Und es sieht nur feste Attribute im
// JSX; ein `{...props}` mit `id` darin wird als fehlend gezaehlt.
//
// Deshalb eine Obergrenze statt Nulltoleranz: Sie haelt den Stand fest, und
// jedes NEUE Feld ohne Namen faellt auf.
//
// Aufruf:  node scripts/formularfelder.mjs [Wurzel] [Obergrenze]
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

/** Ende des Attributbereichs eines Tags. Zaehlt Klammern und ueberspringt
 *  Zeichenketten — dieselbe Vorsicht wie in `check-beschriftung.mjs`, wo
 *  eine naive Suche 57 von 90 Faellen uebersah. */
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

const proDatei = new Map();
let gesamt = 0;

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const zeilenAnfang = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') zeilenAnfang.push(i + 1);
  const zeileVon = (pos) => {
    let lo = 0, hi = zeilenAnfang.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (zeilenAnfang[m] <= pos) lo = m; else hi = m - 1; }
    return lo + 1;
  };

  for (const m of text.matchAll(/<(input|textarea|select)\b/g)) {
    const ende = endeDerAttribute(text, m.index + m[0].length);
    if (ende === -1) continue;
    const attribute = text.slice(m.index + m[0].length, ende);
    if (/\b(id|name)\s*=/.test(attribute)) continue;
    gesamt++;
    if (!proDatei.has(datei)) proDatei.set(datei, []);
    proDatei.get(datei).push({ art: m[1], zeile: zeileVon(m.index) });
  }
}

const sortiert = [...proDatei.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\nFormularfelder ohne id und ohne name: ${gesamt} in ${proDatei.size} Dateien — erlaubt sind ${obergrenze}.\n`);
for (const [datei, treffer] of sortiert.slice(0, 15)) {
  console.log(`  ${String(treffer.length).padStart(3)}  ${datei}`);
  for (const t of treffer.slice(0, 3)) console.log(`         Zeile ${t.zeile} (${t.art})`);
  if (treffer.length > 3) console.log(`         … und ${treffer.length - 3} weitere`);
}
if (sortiert.length > 15) console.log(`\n  … und ${sortiert.length - 15} weitere Dateien`);

if (gesamt > obergrenze) {
  console.log(`
Ohne \`name\` oder \`id\` fuellt der Browser ein Feld nicht automatisch aus,
und eine <label for="…"> kann sich auf nichts beziehen. \`aria-label\` deckt
die Vorlesehilfe ab, aber nicht den Klick auf die Beschriftung.
`);
  process.exit(1);
}
console.log('');
