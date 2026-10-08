#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Diagramme, deren Zahlen im Quelltext stehen.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `src/components/InsightsChart.tsx` zeichnete eine Liniengrafik mit zwei
// Kurven, „Gestartet" und „Antworten", ueber Mo bis So. Die Zahlen standen
// oben in der Datei:
//
//     const data = [
//       { name: 'Mo', initiated: 2, replies: 1 },
//       { name: 'Di', initiated: 3, replies: 2 },
//       …
//       { name: 'So', initiated: 7, replies: 6 },
//     ];
//
// Jeder Mensch sah dieselbe steigende Kurve — am ersten Tag wie im dritten
// Monat, ob mit oder ohne ein einziges Gespraech. Eine steigende Kurve ist
// die glaubwuerdigste Form von Erfindung: Sie sagt „es laeuft", und niemand
// prueft eine gute Nachricht nach.
//
// ── WARUM EIN EIGENES SKRIPT ──────────────────────────────────────────────
// `client-ersatz.mjs` findet erfundene ANTWORTEN (Ersatztexte, wenn ein
// Aufruf scheitert). Erfundene ANZEIGEN sind ein anderer Fall: Da scheitert
// nichts, es wird nie etwas abgefragt. Nur das Auge merkt es — und das Auge
// sieht eine huebsche Kurve.
//
// ── WIE GEPRUEFT WIRD ─────────────────────────────────────────────────────
// 1. Gesucht wird `data={NAME}` an einem recharts-Diagramm
//    (LineChart, BarChart, AreaChart, RadarChart, PieChart, ComposedChart,
//    ScatterChart, RadialBarChart, Treemap, FunnelChart).
// 2. Steht `NAME` in derselben Datei als `const NAME = [ … ]` auf
//    Modulebene — also NICHT in einer Funktion, nicht aus `useState`, nicht
//    aus einem Aufruf — und enthaelt das Literal Zahlen, gilt es als
//    erfunden.
//
// Eine Liste ohne Zahlen (Achsenbeschriftungen, Farben, Reihenfolgen) faellt
// nicht auf. Das ist Absicht: Nicht jede feste Liste ist eine Behauptung
// ueber den Menschen davor.
//
// ── WAS DIESE PRUEFUNG NICHT SIEHT ────────────────────────────────────────
// · `data={[{…}]}` direkt im JSX, ohne Zwischenname.
// · Feste Zahlen, die erst in der Komponente zusammengerechnet werden.
// · Ein `useState(FESTE_LISTE)`, das nie ueberschrieben wird — der Wert
//   sieht dann veraenderlich aus und ist es nicht.
// Deshalb eine Obergrenze statt Nulltoleranz.
//
// Aufruf:  node scripts/erfundene-diagrammdaten.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

const DIAGRAMME =
  'LineChart|BarChart|AreaChart|RadarChart|PieChart|ComposedChart|ScatterChart|RadialBarChart|Treemap|FunnelChart';

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

/** Das Ende eines Array-Literals ab `[`. Zaehlt Klammern, ueberspringt Text. */
function endeDesArrays(text, start) {
  let i = start, tiefe = 0, anfuehrung = null;
  while (i < text.length) {
    const z = text[i];
    if (anfuehrung) {
      if (z === '\\') { i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++; continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; i++; continue; }
    if (z === '[') tiefe++;
    else if (z === ']') { tiefe--; if (tiefe === 0) return i; }
    i++;
  }
  return -1;
}

const treffer = [];

for (const datei of dateien(wurzel)) {
  const roh = readFileSync(datei, 'utf8');
  const text = ohneKommentare(roh);

  // Welche Namen werden an ein Diagramm uebergeben?
  const namen = new Set();
  for (const m of text.matchAll(new RegExp(`<(?:${DIAGRAMME})\\b[^>]*?\\bdata=\\{\\s*([A-Za-z_$][\\w$]*)\\s*\\}`, 'gs'))) {
    if (m[1]) namen.add(m[1]);
  }
  if (namen.size === 0) continue;

  for (const name of namen) {
    // Auf Modulebene deklariert? Kein fuehrendes Leerzeichen vor `const`.
    const dekl = new RegExp(`^const ${name}\\b[^=]*=\\s*\\[`, 'm');
    const stelle = dekl.exec(text);
    if (!stelle) continue;

    const klammer = text.indexOf('[', stelle.index);
    const ende = endeDesArrays(text, klammer);
    if (ende === -1) continue;
    const inhalt = text.slice(klammer, ende + 1);

    // Enthaelt das Literal Zahlen? Eine reine Namensliste ist keine
    // Behauptung ueber den Menschen davor.
    if (!/[:,[]\s*-?\d+(\.\d+)?\s*[,}\]]/.test(inhalt)) continue;

    const zeile = text.slice(0, stelle.index).split('\n').length;
    const zahlen = (inhalt.match(/-?\d+(\.\d+)?/g) ?? []).length;
    treffer.push({ datei, name, zeile, zahlen });
  }
}

treffer.sort((a, b) => b.zahlen - a.zahlen);

console.log(`\nDiagramme mit festen Zahlen im Quelltext: ${treffer.length} — erlaubt sind ${obergrenze}.\n`);
for (const t of treffer) {
  console.log(`  ${t.datei}:${t.zeile}  const ${t.name} = [ … ]  (${t.zahlen} Zahlen)`);
}

if (treffer.length > obergrenze) {
  console.log(`
Ein Diagramm mit festen Zahlen behauptet etwas ueber den Menschen davor —
an jedem Tag dasselbe, ob es zutrifft oder nicht. Richtig ist eines von
dreien:
  · die Zahlen aus echten Daten holen
  · die Karte ausblenden, solange es nichts auszuwerten gibt
  · das Diagramm entfernen
`);
  process.exit(1);
}
console.log('');
