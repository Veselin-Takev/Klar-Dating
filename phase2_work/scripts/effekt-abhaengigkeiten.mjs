#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Effekte, die bei JEDEM Rendern neu laufen.
//
// ── DER BEFUND VOM 14.08.2026 (im Browser beobachtet) ─────────────────────
// Die Netzwerkleiste zeigte 1.883 Anfragen und 23,9 MB fuer einen einzigen
// Seitenaufruf, dazu wiederholt:
//
//   POST /api/daily-icebreakers  ->  429 Too Many Requests
//
// Ursache: `DailyIcebreakerWidget` haengt seinen Effekt an
//
//     }, [userInterests, matchesInterests]);
//
// und `Dashboard.tsx` uebergibt
//
//     const uniqueVerbindungenInterests = Array.from(new Set(…)).slice(0, 10);
//     <DailyIcebreakerWidget … matchesInterests={uniqueVerbindungenInterests} />
//
// Das ist bei JEDEM Rendern ein NEUES Feld. React vergleicht die
// Abhaengigkeiten mit `Object.is` — zwei Felder mit gleichem Inhalt sind
// verschieden. Also lief der Effekt bei jedem Rendern, und mit ihm der
// Aufruf. Dass die Karte nichts anzeigte (sie blendet sich bei Fehler aus),
// hat es unsichtbar gemacht: Die Anfragen liefen weiter, nur sah man nichts.
//
// ── WARUM DAS TEUER IST ───────────────────────────────────────────────────
// `/api/daily-icebreakers` ist ein KI-Endpunkt. Jeder Aufruf geht auf die
// Rechnung des Betreibers. Als Gast greift nach 15 Aufaufen die Grenze
// (429) — deshalb war der Fehler ueberhaupt sichtbar. Bei einem
// angemeldeten Konto sind es 60 pro Stunde, und der Sturm faellt gar nicht
// auf.
//
// ── WIE GEPRUEFT WIRD ─────────────────────────────────────────────────────
// Gesucht wird genau die Bauform aus dem Befund:
//
//   1. Ein Baustein bekommt eine Eigenschaft, deren Typ ein FELD oder
//      OBJEKT ist (`string[]`, `Array<…>`, `{ … }`).
//   2. Ein `useEffect` haengt an dieser Eigenschaft.
//   3. Im Rumpf dieses Effekts steht ein Netzaufruf (`fetch(`, `authFetch`,
//      oder ein Aufruf aus `lib/api`).
//
// Alle drei zusammen sind der Fehler. Einzeln ist keines davon einer:
// Ein Effekt darf an einem Feld haengen, solange er nichts Teures tut, und
// ein Netzaufruf im Effekt ist voellig richtig, solange die Abhaengigkeiten
// stabil sind.
//
// ── ERSTER VERSUCH, VERWORFEN ─────────────────────────────────────────────
// Die erste Fassung suchte nach Bezeichnern, die in derselben Datei aus
// `.map(`/`.filter(`/`Array.from(` gebildet werden. Ergebnis: ZWEI Treffer,
// BEIDE falsch —
//
//   ConversationStatsWidget:40  `data` stammt aus `useState(…)` und ist
//                               stabil; der Treffer kam von einem `const`
//                               INNERHALB einer Hilfsfunktion.
//   DatePreparationChecklist:69 `progress` ist eine ZAHL. Zwei gleiche
//                               Zahlen sind fuer `Object.is` derselbe Wert.
//
// Und den echten Fall fand sie nicht, weil der neue Wert im ELTERNTEIL
// entsteht. Eine Pruefung mit zwei Fehltreffern und null Treffern ist
// schlechter als keine — sie erzeugt Arbeit und Vertrauen zugleich, beides
// unverdient. Deshalb diese engere, an der Typangabe entlanggefuehrte
// Fassung.
//
// ── WAS DIESE PRUEFUNG NICHT SIEHT ────────────────────────────────────────
// · Eigenschaften ohne Typangabe (`props: any`).
// · Einen neuen Wert, der ueber einen Zwischenschritt in den Effekt kommt.
// · Einen teuren Aufruf, der nicht wie ein Netzaufruf aussieht.
// Die eigentliche Absicherung sitzt deshalb IM Baustein: Er haengt seither
// am INHALT (`feld.join('|')`) statt an der Kennung. Diese Pruefung faengt
// den naechsten, der es wieder anders macht.
//
// Aufruf:  node scripts/effekt-abhaengigkeiten.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

function ohneKommentare(quelle) {
  let aus = '', i = 0, anfuehrung = null;
  while (i < quelle.length) {
    const z = quelle[i];
    const zwei = quelle.slice(i, i + 2);
    if (anfuehrung) {
      aus += z;
      if (z === '\\') { aus += quelle[i + 1] ?? ''; i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++; continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; aus += z; i++; continue; }
    if (zwei === '//') { while (i < quelle.length && quelle[i] !== '\n') { aus += ' '; i++; } continue; }
    if (zwei === '/*') {
      while (i < quelle.length && quelle.slice(i, i + 2) !== '*/') { aus += quelle[i] === '\n' ? '\n' : ' '; i++; }
      aus += '  '; i += 2; continue;
    }
    aus += z; i++;
  }
  return aus;
}

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) aus.push(p);
  }
  return aus;
}

/** Typen, die bei jedem Rendern einen neuen Wert ergeben koennen. */
const FELD_ODER_OBJEKT = /(\[\s*\]|\bArray\s*<|^\s*\{|\bRecord\s*<|\bMap\s*<|\bSet\s*<)/;

/** Sieht das nach einem Netzaufruf aus? */
const NETZAUFRUF = /\bfetch\s*\(|\bauthFetch\b|\bapi\.[a-zA-Z]+\s*\(|\baskAICoach\s*\(/;

/**
 * Die Eigenschaften eines Bausteins, deren Typ ein Feld oder Objekt ist.
 *
 * Erfasst beide Schreibweisen, die im Projekt vorkommen:
 *   interface XProps { a: string[]; b: number }
 *   function X({ a, b }: { a: string[]; b: number })
 */
function feldEigenschaften(text) {
  const namen = new Set();
  const bloecke = [];

  for (const m of text.matchAll(/\binterface\s+\w*Props\w*\s*\{/g)) {
    const ende = text.indexOf('}', m.index);
    if (ende !== -1) bloecke.push(text.slice(m.index, ende));
  }
  for (const m of text.matchAll(/\}\s*:\s*\{([^}]*)\}\s*\)/g)) {
    bloecke.push(m[1] ?? '');
  }

  for (const block of bloecke) {
    for (const zeile of block.split(/[;\n,]/)) {
      const e = /^\s*(\w+)\s*\??\s*:\s*(.+)$/.exec(zeile);
      if (!e) continue;
      const [, name, typ] = e;
      if (FELD_ODER_OBJEKT.test(typ)) namen.add(name);
    }
  }
  return namen;
}

const treffer = [];

for (const datei of dateien(wurzel)) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const eigenschaften = feldEigenschaften(text);
  if (eigenschaften.size === 0) continue;

  for (const m of text.matchAll(/\buseEffect\s*\(/g)) {
    const ab = text.slice(m.index, m.index + 8000);
    const liste = /\}\s*,\s*\[([^\]]*)\]\s*\)/.exec(ab);
    if (!liste) continue;
    const rumpf = ab.slice(0, liste.index);
    if (!NETZAUFRUF.test(rumpf)) continue;

    const namen = (liste[1] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    for (const n of namen) {
      if (!eigenschaften.has(n)) continue;
      treffer.push({ datei, zeile: text.slice(0, m.index).split('\n').length, name: n });
    }
  }
}

console.log(`\nEffekte mit Netzaufruf, die an einer Feld-Eigenschaft haengen: ${treffer.length} — erlaubt sind ${obergrenze}.\n`);
for (const t of treffer) {
  console.log(`  ${t.datei}:${t.zeile}  haengt an der Eigenschaft \`${t.name}\``);
}

if (treffer.length > obergrenze) {
  console.log(`
React vergleicht Abhaengigkeiten mit \`Object.is\`. Ein Feld, das der
Elternteil bei jedem Rendern neu bildet, ist jedes Mal ein anderer Wert —
der Effekt laeuft also bei JEDEM Rendern des Elternteils. Steht ein
Netzaufruf darin, wird daraus ein Dauerfeuer; bei einem KI-Endpunkt kostet
jedes Feuer Geld.

Am 14.08.2026 waren das 1.883 Anfragen fuer einen Seitenaufruf, bis die
Gastgrenze mit 429 dazwischenging.

Richtig ist: am INHALT haengen statt an der Kennung —
  }, [userInterests.join('|'), matchesInterests.join('|')]);
Der Baustein ist damit unabhaengig davon, was der Elternteil tut.
`);
  process.exit(1);
}
console.log('');
