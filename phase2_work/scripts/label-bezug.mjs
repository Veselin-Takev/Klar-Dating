#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// `<label>`-Elemente, die sich auf kein Formularfeld beziehen.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Chrome meldet im Reiter „Probleme":
//
//   „No label associated with a form field."  4 Ressourcen
//
// Das ist NICHT dasselbe wie die Meldung zu `id`/`name` — und es ist der
// Fall, den ich beim vorigen Commit halb behoben habe: Die beiden Farbfelder
// im Werte-Radar haben seitdem eine `id`, aber das `<label>` daneben hat
// weiterhin kein `htmlFor`. Die Beschriftung stand also richtig da und war
// trotzdem mit nichts verbunden.
//
// ── WARUM DAS ZAEHLT ──────────────────────────────────────────────────────
// · Der Klick auf die Beschriftung setzt den Fokus nicht ins Feld. Bei einem
//   Kaestchen oder einem Farbwaehler ist die Beschriftung oft das groessere
//   Ziel — sie nicht anklickbar zu machen, verschenkt genau die Flaeche, die
//   die 44-px-Regel aus Richtlinie 2.0 verlangt.
// · Vorlesehilfen nennen das Feld ohne Bezug nicht beim Namen, selbst wenn
//   die Beschriftung direkt daneben steht. `aria-label` waere ein Ersatz —
//   aber dann steht der Name zweimal da und kann auseinanderlaufen.
//
// ── ZWEI RICHTIGE FORMEN ──────────────────────────────────────────────────
//   <label htmlFor="feld">Name</label> <input id="feld" …/>
//   <label>Name <input …/></label>          (verschachtelt)
// Beide gelten hier als in Ordnung; gezaehlt wird nur, was keines von beidem
// ist.
//
// ── GRENZE ────────────────────────────────────────────────────────────────
// Ein `htmlFor`, das auf eine `id` zeigt, die es nicht gibt, faellt hier
// NICHT auf. Das braucht den Browser oder einen Baumtest.
//
// Aufruf:  node scripts/label-bezug.mjs [Wurzel] [Obergrenze]
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

const proDatei = new Map();
let gesamt = 0;

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));

  for (const m of text.matchAll(/<label\b/g)) {
    const ende = endeDerAttribute(text, m.index + m[0].length);
    if (ende === -1) continue;
    const attribute = text.slice(m.index + m[0].length, ende);
    if (/\bhtmlFor\s*=/.test(attribute)) continue;

    // Verschachtelt? Dann braucht es kein `htmlFor`.
    const schluss = text.indexOf('</label>', ende);
    const inhalt = schluss === -1 ? '' : text.slice(ende, schluss);
    if (/<(input|textarea|select)\b/.test(inhalt)) continue;

    gesamt++;
    const zeile = text.slice(0, m.index).split('\n').length;
    if (!proDatei.has(datei)) proDatei.set(datei, []);
    proDatei.get(datei).push(zeile);
  }
}

const sortiert = [...proDatei.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\n<label> ohne Bezug zu einem Feld: ${gesamt} in ${proDatei.size} Dateien — erlaubt sind ${obergrenze}.\n`);
for (const [datei, zeilen] of sortiert) {
  console.log(`  ${String(zeilen.length).padStart(3)}  ${datei}  (Zeilen ${zeilen.slice(0, 5).join(', ')}${zeilen.length > 5 ? ', …' : ''})`);
}

if (gesamt > obergrenze) {
  console.log(`
Richtig ist eines von beidem:
  <label htmlFor="feld">Name</label> <input id="feld" …/>
  <label>Name <input …/></label>
Ohne Bezug setzt der Klick auf die Beschriftung den Fokus nicht ins Feld,
und Vorlesehilfen nennen das Feld nicht beim Namen.
`);
  process.exit(1);
}
console.log('');
