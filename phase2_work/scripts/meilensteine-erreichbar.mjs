#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Kann jeder Meilenstein ueberhaupt erreicht werden?
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Von den 17 Auszeichnungen in den drei Meilenstein-Anzeigen waren elf
// dauerhaft unerreichbar. Sechs lasen Speicherschluessel, die NIRGENDS
// geschrieben werden:
//
//   stats_conversations_started    stats_match_compass_activity
//   stats_successful_icebreakers   klar_chats_started
//   klar_chat_streak               klar_ritual_tracker
//
// Fuenf weitere standen in `DatingMilestonesWidget.tsx` fest auf `false`,
// mit dem Kommentar „P2: war fest verdrahtet".
//
// Das faellt niemandem auf, weil ein unerreichter Meilenstein genauso
// aussieht wie ein unerreichbarer: ein graues Kaestchen. Der Unterschied
// ist, dass das eine ein Ziel ist und das andere eine Zumutung.
//
// ── WIE GEPRUEFT WIRD ─────────────────────────────────────────────────────
// 1. Aus `src/lib/meilensteine.ts` wird der Block
//
//        export const SCHLUESSEL = { … } as const;
//
//    gelesen — eine Zuweisung je Zeile, Wert in einfachen
//    Anfuehrungszeichen.
// 2. Fuer jeden Wert wird in `src` eine Schreibstelle gesucht:
//    `localStorage.setItem('<schluessel>'` bzw. mit doppelten
//    Anfuehrungszeichen. Die Meilenstein-Dateien selbst zaehlen nicht mit —
//    sonst genuegte es, den Schluessel im Lesen zu erwaehnen.
//
// ── ZWEI GRENZEN, AUSDRUECKLICH ───────────────────────────────────────────
// · Ein `setItem(variable)` faellt nicht auf. Wer den Schluessel erst
//   zusammensetzt, wird hier nicht erfasst.
// · Die Pruefung kennt keine Firestore-Felder. Wandert ein Zaehler dorthin,
//   muss diese Pruefung mitwandern.
// Beides ist besser als nichts: Der Fall, der am 14.08. vorlag — ein
// Schluessel, den niemand je schreibt — faellt zuverlaessig auf.
//
// ── NULLTOLERANZ, KEINE OBERGRENZE ────────────────────────────────────────
// Anders als bei `formularfelder` oder `label-bezug` gibt es hier keinen
// Altbestand zu dulden: Die Liste ist heute vollstaendig erreichbar. Wer
// einen Meilenstein aufnimmt, baut zuerst die Stelle, die ihn zaehlt.
//
// Aufruf:  node scripts/meilensteine-erreichbar.mjs [Wurzel]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const quelle = join(wurzel, 'lib', 'meilensteine.ts');

/** Die Dateien, die den Schluessel nur LESEN — sie zaehlen nicht als Beleg. */
const NICHT_ALS_BELEG = /(lib[\\/]meilensteine\.ts|components[\\/]Meilensteine\.tsx|screens[\\/]MeilensteineAlle\.tsx)$/;

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.(ts|tsx)$/.test(p)) aus.push(p);
  }
  return aus;
}

let text;
try {
  text = readFileSync(quelle, 'utf8');
} catch {
  console.error(`Nicht gefunden: ${quelle}`);
  process.exit(1);
}

const anfang = text.indexOf('export const SCHLUESSEL = {');
const ende = anfang === -1 ? -1 : text.indexOf('}', anfang);
if (anfang === -1 || ende === -1) {
  // Eine Pruefung, die ihren Gegenstand nicht findet, meldet „alles gut" —
  // genau das darf hier nicht passieren.
  console.error(`In ${quelle} steht kein Block \`export const SCHLUESSEL = { … }\`.`);
  console.error('Wurde er umbenannt oder umgeformt? Dann bitte dieses Skript mitaendern.');
  process.exit(1);
}

const block = text.slice(anfang, ende);
const schluessel = [...block.matchAll(/^\s*\w+:\s*'([^']+)'/gm)].map((m) => m[1]);

if (schluessel.length === 0) {
  console.error(`In ${quelle} steht der Block, aber kein einziger Schluessel darin.`);
  process.exit(1);
}

const quellen = dateien(wurzel).filter((p) => !NICHT_ALS_BELEG.test(p));
const inhalte = quellen.map((p) => [p, readFileSync(p, 'utf8')]);

const ohneSchreibstelle = [];
console.log(`\nMeilenstein-Schluessel: ${schluessel.length}\n`);

for (const s of schluessel) {
  const muster = new RegExp(`setItem\\(\\s*['"\`]${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
  const belege = inhalte.filter(([, inhalt]) => muster.test(inhalt)).map(([p]) => p);
  if (belege.length === 0) {
    ohneSchreibstelle.push(s);
    console.log(`  ✗  ${s.padEnd(28)} keine Schreibstelle`);
  } else {
    const erste = belege[0].replace(/\\/g, '/');
    console.log(`  ✓  ${s.padEnd(28)} ${belege.length}×, z. B. ${erste}`);
  }
}

if (ohneSchreibstelle.length > 0) {
  console.log(`
${ohneSchreibstelle.length} Schluessel werden nirgends geschrieben. Ein Meilenstein, der
daran haengt, ist dauerhaft grau — er sieht aus wie ein Ziel und ist keins.

Richtig ist eines von beidem:
  · die Stelle bauen, die den Fortschritt zaehlt (localStorage.setItem)
  · den Meilenstein aus MEILENSTEINE nehmen und in ENTFALLEN eintragen
`);
  process.exit(1);
}

console.log(`\nAlle ${schluessel.length} Schluessel haben eine Schreibstelle.\n`);
