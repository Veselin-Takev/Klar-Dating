#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Prüft: wird ein React-Hook benutzt, der nicht importiert ist?
//
// WOZU: `useRef is not defined` legte am 10.08.2026 das Dashboard lahm. Der
// Fehler war unsichtbar, weil `@ts-nocheck` in acht Dateien den Compiler
// abschaltet — genau die Prüfung also, die das gefunden hätte.
//
// WARUM EIN EIGENES SKRIPT UND NICHT GREP: Zwei Formen brachen den ersten
// Versuch, beide in diesem Projekt vorhanden:
//   1. `import React, { useState } from 'react'` — der Vorgabe-Import davor
//      liess die Klammer-Suche ins Leere laufen  → falscher Alarm.
//   2. `useRef<NodeJS.Timeout | null>(…)` — zwischen Name und Klammer steht
//      eine Generic → `useRef(` findet nichts  → übersehener echter Fehler.
// Beide Richtungen sind vorgekommen. Deshalb hier ein Matcher, der die
// Importliste zerlegt statt sie zu erraten.
//
// GRENZE, AUSDRÜCKLICH: Das ist eine Textprüfung, kein Parser. Ein Hook in
// einer Zeichenkette oder in einem Kommentar zählt sie mit. Sie ersetzt
// `tsc` nicht — sie schliesst die Lücke, die `@ts-nocheck` reisst.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const HOOKS = [
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext',
  'useReducer', 'useLayoutEffect', 'useTransition', 'useDeferredValue',
  'useId', 'useSyncExternalStore', 'useImperativeHandle', 'useOptimistic',
  'useActionState', 'useInsertionEffect', 'useDebugValue',
];

/** Kommentare entfernen, bevor gesucht wird.
 *
 *  WARUM: Der erste Durchlauf meldete `setReportSubmitted` in
 *  `src/server/trustAndSafety.ts`. Dort steht der Name aber nur im
 *  Kommentar, der einen früheren Befund beschreibt. Genau dieses Muster —
 *  die Suche findet ihre eigene Dokumentation — hat am 10.08.2026 fünf
 *  falsche Alarme erzeugt.
 *
 *  GRENZE: `//` innerhalb einer Zeichenkette wird mitgeschnitten, ausser
 *  bei `://` (Protokoll). Für die Zwecke hier unschädlich: Was danach
 *  wegfällt, kann keinen zusätzlichen `setXxx(`-Treffer erzeugen. */
const ohneKommentare = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((zeile) => zeile.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

const dateien = execSync(
  `find src -name '*.tsx' -o -name '*.ts' | grep -v '\\.d\\.ts$'`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

/** Alle Namen, die aus 'react' importiert werden — egal in welcher Form.
 *  Deckt ab: `import { a, b }`, `import React, { a }`, mehrzeilig,
 *  einfache und doppelte Anführungszeichen, `as`-Umbenennung. */
function reactImporte(text) {
  const namen = new Set();
  let sternImport = null;

  // import * as React from 'react'
  const stern = text.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]react['"]/);
  if (stern) sternImport = stern[1];
  // import React from 'react'  |  import React, { … } from 'react'
  const vorgabe = text.match(
    /import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]react['"]/,
  );
  if (vorgabe) sternImport = vorgabe[1];

  // Der geschweifte Teil, mit oder ohne Vorgabe-Import davor.
  //
  // `[^}]` statt `[\s\S]*?`: Die faule Fassung sprang über fremde
  // Import-Zeilen hinweg bis zur nächsten schliessenden Klammer vor
  // `from 'react'` und schnitt die Namensliste mittendurch — Login.tsx und
  // Confetti.tsx wurden dadurch fälschlich gemeldet. Eine Zeichenklasse
  // ohne `}` kann eine Klammer nicht überspringen.
  for (const m of text.matchAll(
    /import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"]/g,
  )) {
    for (const roh of m[1].split(',')) {
      const teil = roh.trim();
      if (!teil) continue;
      // `useState as useZustand` → der lokal gültige Name ist der hintere.
      const alias = teil.match(/^\s*(\w+)\s+as\s+(\w+)\s*$/);
      namen.add(alias ? alias[2] : teil.replace(/^type\s+/, ''));
    }
  }
  return { namen, sternImport };
}

/** Wird der Hook wirklich aufgerufen? `useRef(` UND `useRef<Typ>(`.
 *  Wortgrenze davor, damit `myUseRef(` nicht zählt. */
function wirdBenutzt(text, hook) {
  const re = new RegExp(`(?<![\\w.])${hook}\\s*(?:<[^;{}()]*>\\s*)?\\(`);
  return re.test(text);
}

const befunde = [];
for (const datei of dateien) {
  const roh = readFileSync(datei, 'utf8');
  const text = ohneKommentare(roh);
  const { namen, sternImport } = reactImporte(roh);
  for (const hook of HOOKS) {
    if (!wirdBenutzt(text, hook)) continue;
    if (namen.has(hook)) continue;
    // Über den Stern-/Vorgabe-Import benutzt: React.useRef(…)
    if (sternImport && text.includes(`${sternImport}.${hook}`)) continue;
    // Eigene Definition in derselben Datei (z. B. ein eigener Haken).
    if (new RegExp(`(?:function|const|let)\\s+${hook}\\b`).test(text)) continue;
    befunde.push({ datei, hook });
  }
}

// ── Zweite Prüfung: Zustands-Setzer ohne Deklaration ──────────────────────
//
// WOZU: `showFilterSheet is not defined` legte am 10.08.2026 das Dashboard
// lahm, `showPhotoVerification` haette dasselbe mit dem Profil getan, und in
// ChatDatePlanner fehlten drei weitere. Alle vier derselbe Fehler: ein
// `setXxx(...)` ohne zugehöriges `useState`. Gleiche Ursache wie beim
// fehlenden Haken-Import — `@ts-nocheck` schaltet den Compiler ab.
//
// Wird der Wert erst in einem Ereignis gesetzt (ChatDatePlanner), stürzt es
// nicht beim Rendern, sondern erst beim Antippen. Solche Fälle findet kein
// Durchklicken zuverlässig — deshalb diese Prüfung.
const EINGEBAUT = new Set(['setTimeout', 'setInterval', 'setImmediate']);

for (const datei of dateien) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const setzer = new Set(
    [...text.matchAll(/(?<![\w.])(set[A-Z]\w*)\s*\(/g)].map((m) => m[1]),
  );
  for (const s of setzer) {
    if (EINGEBAUT.has(s)) continue;
    const deklariert =
      // `const [wert, setWert] = useState(…)` — der Lesename darf fehlen:
      // `const [, setWert]` ist im Projekt gebräuchlich, wenn nur geschrieben
      // wird. `\w*` statt `\w+` war der Unterschied zwischen 12 falschen
      // Meldungen und keiner.
      new RegExp(`\\[\\s*\\w*\\s*,\\s*${s}\\s*\\]`).test(text) ||
      new RegExp(`(?:const|let|var|function)\\s+${s}\\b`).test(text) ||
      // Class method declarations are not calls to missing React setters.
      new RegExp(`(?:public|private|protected|static)\\s+(?:(?:static|async)\\s+)*${s}\\s*\\(`).test(text) ||
      // als Eigenschaft übergeben oder in einem Typ vereinbart
      new RegExp(`${s}\\s*[?]?\\s*[:,}]`).test(text);
    if (!deklariert) befunde.push({ datei, hook: `${s} (kein useState)` });
  }
}

if (befunde.length === 0) {
  console.log('Haken-Importe und Zustands-Deklarationen: keine Lücke gefunden.');
  process.exit(0);
}
console.error(`Benutzt, aber nicht deklariert — ${befunde.length} Stück:\n`);
for (const b of befunde) console.error(`  ${b.datei}  →  ${b.hook}`);
process.exit(1);
