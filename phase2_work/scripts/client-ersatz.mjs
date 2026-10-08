#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Sucht erfundene Ersatzantworten im CLIENT.
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Am 10., 11. und 12.08.2026 wurden 18 erfundene Ersatzantworten gefunden und
// beseitigt — alle in `server.ts`. Die Prüfungen dieser Tage
// (`kiErsatzPruefung.mjs`, `ki-anbindung.mjs`) lesen ausschliesslich
// `server.ts`.
//
// Am 13.08.2026 fiel im laufenden Betrieb auf: `KlarMatchWidget.tsx` schreibt
// im `catch` eines gescheiterten KI-Aufrufs
//
//     "Hey, tolles Profil! Hast du Lust zu schreiben?"
//
// in dasselbe Feld, in dem sonst die KI-Antwort steht — und die Oberfläche
// zeigt es als Ergebnis an. Dieselbe Zeile stand im Screenshot unter einem
// Profil. Der Server war sauber; der Client nicht.
//
// DIE REGEL IST DIESELBE WIE IN `kiPolitik.ts`:
// Eine erfundene personenbezogene Auswertung ist niemals zulässig. Ob sie im
// Server oder im Browser entsteht, ändert für die lesende Person nichts.
//
// ── WAS DIESES SKRIPT FINDET ──────────────────────────────────────────────
// `catch`-Blöcke, in denen eine Zustandsfunktion (`setX(...)`) mit einer
// Zeichenkette aufgerufen wird, die echten Text enthält. Das ist das Muster
// „Aufruf gescheitert -> trotzdem etwas Inhaltliches anzeigen".
//
// ── WAS ES NICHT FINDET (bewusst benannt) ─────────────────────────────────
// · Ersatztexte, die über eine Konstante statt eines Literals kommen.
// · Ersatzwerte, die keine Zeichenkette sind (Zahlen, Objekte).
// · Fehlermeldungen, die als Fehler gekennzeichnet sind — die sind richtig
//   und werden über die Liste `ERLAUBT` unten ausgenommen.
// Ein Fund ist damit ein Hinweis, kein Urteil. Jede Zeile gehört angesehen.
//
// Aufruf:  node scripts/client-ersatz.mjs src [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

// Zeichenketten, die AUSDRÜCKLICH als Fehlermeldung auftreten dürfen. Sie
// behaupten nichts über die lesende Person oder ihr Gegenüber, sondern sagen,
// dass etwas nicht geklappt hat.
const ERLAUBT = [
  /fehlgeschlagen/i, /nicht möglich/i, /nicht verfügbar/i, /später erneut/i,
  /versuche es/i, /keine verbindung/i, /zeitüberschreitung/i, /fehler/i,
  /nicht geladen/i, /konnte nicht/i, /erreicht/i, /zu viele/i,
  // „Konnte X nicht Y" — das Verb steht zwischen den beiden Wörtern, deshalb
  // greift /konnte nicht/ nicht. Sagt aus, dass etwas nicht geklappt hat, und
  // behauptet nichts über die lesende Person.
  /^konnte\b[\s\S]*\bnicht\b/i,
  /nicht geklappt/i, /nicht angekommen/i, /nicht synchronisiert/i,
  /nicht mehr möglich/i, /noch einmal versuch/i,
];

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

/** Findet das Ende eines Blocks ab der öffnenden geschweiften Klammer.
 *  Zählt Klammern und überspringt Zeichenketten — dieselbe Vorsicht wie in
 *  `check-beschriftung.mjs`, wo eine naive Suche 57 von 90 Fällen übersah. */
function blockEnde(text, start) {
  let i = start, tiefe = 0, anfuehrung = null;
  while (i < text.length) {
    const z = text[i];
    if (anfuehrung) {
      if (z === '\\') { i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++; continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; i++; continue; }
    if (z === '{') { tiefe++; i++; continue; }
    if (z === '}') { tiefe--; if (tiefe === 0) return i; i++; continue; }
    i++;
  }
  return -1;
}

// ── Welche Aufrufe gelten als KI-Aufruf? ──────────────────────────────────
// Nur `catch`-Bloecke, deren `try` einen dieser Aufrufe enthaelt, werden
// geprueft. Ohne diese Einschraenkung meldete das Skript auch die
// Anmeldefehler in `Login.tsx` — dort ist ein fester Satz richtig, weil er
// den Fehler benennt und nichts ueber die Person behauptet.
const kiAufrufe = new Set(['askAICoach']);
try {
  const api = readFileSync('src/lib/api.ts', 'utf8');
  for (const m of api.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) kiAufrufe.add(m[1]);
} catch { /* ohne api.ts bleibt die Liste klein — dann meldet das Skript mehr */ }

const funde = [];

for (const datei of dateien(wurzel)) {
  const roh = readFileSync(datei, 'utf8');
  const text = ohneKommentare(roh);
  const zeilenAnfang = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') zeilenAnfang.push(i + 1);
  const zeileVon = (pos) => {
    let lo = 0, hi = zeilenAnfang.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (zeilenAnfang[m] <= pos) lo = m; else hi = m - 1; }
    return lo + 1;
  };

  const re = /\bcatch\s*(\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const auf = text.indexOf('{', m.index);
    const zu = blockEnde(text, auf);
    if (zu === -1) continue;
    const block = text.slice(auf, zu);

    // Steht im zugehoerigen `try` ueberhaupt ein KI-Aufruf? Die 1500 Zeichen
    // vor dem `catch` decken den Rumpf der hier vorkommenden Funktionen ab.
    const davor = text.slice(Math.max(0, m.index - 1500), m.index);
    let istKi = false;
    for (const name of kiAufrufe) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(davor)) { istKi = true; break; }
    }
    if (!istKi) continue;

    // `set…("…")` oder `set…(prev => ({ …: "…" }))`
    const setRe = /\bset[A-Z]\w*\s*\(/g;
    let s;
    while ((s = setRe.exec(block)) !== null) {
      const rest = block.slice(s.index, s.index + 600);
      const lit = rest.match(/["'`]([^"'`]{12,})["'`]/);
      if (!lit) continue;
      const inhalt = lit[1];
      // Muss echten Text enthalten, nicht nur Bezeichner oder CSS.
      if (!/\s/.test(inhalt)) continue;
      if (ERLAUBT.some((r) => r.test(inhalt))) continue;
      funde.push({
        datei,
        zeile: zeileVon(auf + s.index),
        text: inhalt.length > 70 ? inhalt.slice(0, 67) + '…' : inhalt,
      });
    }
  }
}

console.log(`\nErfundene Ersatzantworten im Client: ${funde.length} — erlaubt sind ${obergrenze}.\n`);
for (const f of funde) {
  console.log(`  ${f.datei}:${f.zeile}`);
  console.log(`      "${f.text}"`);
}
if (funde.length > obergrenze) {
  console.log(`
Ein gescheiterter KI-Aufruf darf keinen Inhalt erzeugen, der wie ein
Ergebnis aussieht. Zulaessig sind: ehrlich scheitern, ein als solcher
gekennzeichneter kuratierter Text, ein gespeicherter Stand MIT Datum,
oder gar nichts anzeigen. Siehe src/server/kiPolitik.ts.
`);
  process.exit(1);
}
console.log('');
