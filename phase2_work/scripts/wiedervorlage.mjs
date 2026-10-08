#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Der Merkzettel — alles, was spaeter noch einmal drankommt.
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Am 14.08.2026 wurde entschieden, die Werbe-Monetarisierung fuer das MVP
// zu streichen:
//
//   „Fuer das MVP gilt: Streichen. Besser eine schlanke, voll
//    funktionsfaehige und ehrliche User Journey als unfertige
//    Monetarisierungs-Features. Bitte unbedingt in Dokumentation entnehmen
//    und spaeter explizit noch mal erinnern, wenn das Code sauber und
//    bereit ist."
//
// Ein Vorsatz, sich spaeter zu erinnern, ist keine Erinnerung. Eine Zeile
// in einem Bericht wird gelesen, solange der Bericht neu ist. Deshalb
// dieses Skript: Es sammelt jeden `WIEDERVORLAGE:`-Vermerk aus dem Code und
// gibt ihn bei jedem `npm run verify` aus.
//
// ── DIES IST KEINE PRUEFUNG ───────────────────────────────────────────────
// Es bricht NIE ab und hat keine Obergrenze. Wer den Merkzettel scharf
// stellt, macht ihn zum Hindernis, und Hindernisse werden umgangen. Er
// steht in `package.json` deshalb nicht unter `check:`, sondern als
// `wiedervorlage`.
//
// ── FORM DES VERMERKS ─────────────────────────────────────────────────────
// Irgendwo in einem Kommentar:
//
//   // WIEDERVORLAGE: Kurzer Satz, was wieder drankommt.
//   // Fortsetzung in den Folgezeilen, solange sie eingerueckt weitergehen.
//
// Aufruf:  node scripts/wiedervorlage.mjs [Wurzel ...]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ziele = process.argv.slice(2);
const wurzeln = ziele.length > 0 ? ziele : ['src', 'server.ts', 'scripts', 'tests'];

function dateien(pfad, aus = []) {
  if (!existsSync(pfad)) return aus;
  if (!statSync(pfad).isDirectory()) {
    if (/\.(ts|tsx|mjs|js)$/.test(pfad)) aus.push(pfad);
    return aus;
  }
  for (const e of readdirSync(pfad)) dateien(join(pfad, e), aus);
  return aus;
}

const alle = [];
for (const w of wurzeln) dateien(w, alle);

/** Entfernt Kommentarzeichen und fuehrende Sternchen am Zeilenanfang. */
function blank(zeile) {
  return zeile
    .replace(/^\s*(\/\/+|\*|\/\*+)\s?/, '')   // fuehrende Kommentarzeichen
    .replace(/\*\/\}?\s*$/, '')                // schliessendes */ bzw. */}
    .replace(/\s+/g, ' ')                       // eingerueckte Fortsetzung
    .trim();
}

const eintraege = [];

for (const datei of alle.sort()) {
  const zeilen = readFileSync(datei, 'utf8').split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    const roh = zeilen[i];
    // Der Vermerk in DIESER Datei zaehlt nicht — sonst meldet der
    // Merkzettel sich selbst.
    if (datei.endsWith('wiedervorlage.mjs')) continue;
    const treffer = /WIEDERVORLAGE\s*:\s*(.*)$/.exec(roh);
    if (!treffer) continue;

    const text = [blank(treffer[1] ?? '')].filter(Boolean);
    // Folgezeilen uebernehmen, solange sie Kommentar sind und Text tragen.
    for (let j = i + 1; j < zeilen.length; j++) {
      const naechste = zeilen[j] ?? '';
      if (!/^\s*(\/\/|\*|\s{4,}[A-Za-zÄÖÜäöüß„])/.test(naechste)) break;
      const t = blank(naechste);
      if (!t) break;
      if (/^[─═-]{5,}/.test(t)) break;
      if (/WIEDERVORLAGE\s*:/.test(t)) break;
      text.push(t);
      if (text.join(' ').length > 400) break;
    }
    eintraege.push({ datei, zeile: i + 1, text: text.join(' ') });
  }
}

console.log('\n══ WIEDERVORLAGE ' + '═'.repeat(58));
if (eintraege.length === 0) {
  console.log('\n  Nichts vorgemerkt.\n');
} else {
  console.log(`\n  ${eintraege.length} Vermerk(e) im Code:\n`);
  for (const e of eintraege) {
    console.log(`  ${e.datei}:${e.zeile}`);
    // Auf 76 Zeichen umbrechen, damit es im Terminal lesbar bleibt.
    let rest = e.text;
    while (rest.length > 0) {
      const stueck = rest.length <= 72 ? rest : rest.slice(0, rest.lastIndexOf(' ', 72) + 1 || 72);
      console.log(`      ${stueck.trim()}`);
      rest = rest.slice(stueck.length).trimStart();
    }
    console.log('');
  }
}
console.log('═'.repeat(75) + '\n');
