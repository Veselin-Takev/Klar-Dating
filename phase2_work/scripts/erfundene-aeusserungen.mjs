#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ein fest verdrahteter Satz im Namen einer ANDEREN PERSON.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Beim ersten Rundgang im angemeldeten Zustand, in `ChatView.tsx`:
//
//     // Simulate a delayed response
//     setTimeout(() => {
//       if ('vibrate' in navigator) navigator.vibrate(50);
//       setIntensity(prev => Math.min(100, prev + 10));
//       setMessages(prev => {
//         const markedRead = prev.map(m => m.role === 'user' ? {...m, isRead: true} : m);
//         return [...markedRead, { role: 'verbindung', text: "Hey! Schön von dir zu hören 😊" }];
//       });
//     }, 1500);
//
// 1,5 Sekunden nach JEDER gesendeten Nachricht erschien eine Antwort. Der
// Text stand fest im Quelltext. Dazu wurden die eigenen Nachrichten auf
// „gelesen" gesetzt, das Telefon vibrierte, und ein Fortschrittswert stieg.
//
// Vier Signale, die alle dasselbe behaupteten: dort sei ein Mensch.
//
// ── WARUM DAFUER EINE EIGENE PRUEFUNG NOETIG IST ──────────────────────────
// `check:erfundene-zahlen` sucht `Math.random()`.
// `check:erfundene-diagramme` sucht feste Zahlenreihen.
// Beide haetten hier nichts gemeldet: Es ist kein Zufall und keine Zahl,
// sondern ein Satz. Fuer die bedienende Person ist er die schwerere
// Erfindung — eine falsche Zahl kann man anzweifeln, eine Nachricht von
// einem Menschen nicht.
//
// ── DIE UNTERSCHEIDUNG ────────────────────────────────────────────────────
// Nicht jede feste Zeichenkette ist verboten:
//
//   role: 'user'   — die eigene Eingabe. Kommt nie fest aus dem Code.
//   role: 'ai'     — der Coach. DIE APP SPRICHT SELBST. Eine feste
//                    Begruessung ist hier ehrlich; sie gibt sich nicht als
//                    Mensch aus.
//   role: 'verbindung' — eine ANDERE PERSON. Hier ist jede feste
//                    Zeichenkette eine Erfindung, ohne Ausnahme.
//
// Aufruf:  node scripts/erfundene-aeusserungen.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

/** Rollen, die einen anderen MENSCHEN darstellen. */
const FREMDE_ROLLEN = ['verbindung', 'partner', 'match', 'kontakt', 'other'];

// ── WARUM HIER KEIN ZEICHENWEISER SCANNER STEHT ───────────────────────────
// Der erste Entwurf benutzte denselben Kommentar-Entferner wie
// `erfundene-zahlen.mjs`: zeichenweise, mit Merker fuer Zeichenketten. Er hat
// SOFORT falsch gemeldet — und zwar den erklaerenden Kommentar zu genau
// diesem Befund.
//
// Ursache, gemessen: ChatView.tsx:478 beginnt ein MEHRZEILIGES
// Template-Literal. Darin stehen `${…}`-Abschnitte mit echtem Code:
//
//     `… war "${savedSentiment === 'positive' ? 'sehr positiv' : …}". `
//
// Der Scanner haelt alles zwischen den Backticks fuer eine Zeichenkette. Bei
// verschachtelten Backticks kippt die Parität — und ab da wird KEIN
// Kommentar mehr entfernt. Ab Zeile 478 war die Erkennung blind.
//
// OFFEN, und hier nur festgehalten: `erfundene-zahlen.mjs` benutzt denselben
// Scanner. Dieselbe Blindheit ist dort moeglich — es waere die dritte
// Wiederholung dieser Falle (siehe die Kommentare in `formularfelder.mjs`
// und `routen-inventar.mjs`). Das gehoert eigenstaendig geprueft, nicht
// nebenbei in einer anderen Aenderung.
//
// Diese Pruefung arbeitet ZEILENWEISE. Deshalb genuegt der einfache Weg: eine
// Zeile, die als Kommentar beginnt, wird uebersprungen. Kein Zustand, keine
// Paritaet, nichts, was kippen kann.
function istKommentarzeile(zeile) {
  const z = zeile.trim();
  return z.startsWith('//') || z.startsWith('*') || z.startsWith('/*');
}

function dateien(w, aus = []) {
  for (const e of readdirSync(w)) {
    const p = join(w, e);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) aus.push(p);
  }
  return aus;
}

const rollen = FREMDE_ROLLEN.join('|');
// role: 'verbindung' … text: "…"   oder umgekehrt, innerhalb eines Objekts.
const MUSTER = [
  new RegExp(`role:\\s*['"\`](?:${rollen})['"\`]\\s*,\\s*text:\\s*['"\`][^'"\`]+['"\`]`, 'g'),
  new RegExp(`text:\\s*['"\`][^'"\`]+['"\`]\\s*,\\s*role:\\s*['"\`](?:${rollen})['"\`]`, 'g'),
];

const treffer = [];
for (const datei of dateien(wurzel)) {
  const zeilen = readFileSync(datei, 'utf8').split('\n');
  zeilen.forEach((z, i) => {
    if (istKommentarzeile(z)) return;
    for (const m of MUSTER) {
      m.lastIndex = 0;
      if (m.test(z)) {
        treffer.push({ datei, zeile: i + 1, inhalt: z.trim().slice(0, 130) });
        break;
      }
    }
  });
}

console.log(`\nFeste Saetze im Namen einer anderen Person: ${treffer.length} — erlaubt sind ${obergrenze}.`);
console.log(`(Rollen, die als Mensch gelten: ${FREMDE_ROLLEN.join(', ')}. \`ai\` und \`user\` sind ausgenommen — dort spricht die App selbst bzw. die Person.)\n`);

for (const t of treffer) {
  console.log(`  ${t.datei}:${t.zeile}`);
  console.log(`      ${t.inhalt}`);
}

if (treffer.length > obergrenze) {
  console.log(`
Eine erfundene ZAHL ist eine falsche Anzeige. Eine erfundene AEUSSERUNG einer
Person ist etwas anderes: Wer sie liest, glaubt, jemand habe geantwortet.

Das widerspricht der Zusage der App unmittelbar — „Echtes Dating ohne
Spielchen … niemals mit deiner Wuerde".

Soll die Oberflaeche etwas sagen, wenn niemand antwortet, dann als HINWEIS
der App (eigene Darstellung, erkennbar nicht von einem Menschen) — nicht als
Nachricht in fremdem Namen.
`);
  process.exit(1);
}
console.log('');
