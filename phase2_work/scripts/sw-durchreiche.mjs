#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Reicht der Service Worker durch, was er durchreichen muss?
//
// ── DER ANLASS VOM 14.08.2026 ─────────────────────────────────────────────
// Die Google-Anmeldung scheiterte mit `auth/internal-error`. In der Konsole:
//
//   Fetch API cannot load https://apis.google.com/js/api.js?onload=...
//   Refused to connect because it violates the document's
//   Content Security Policy.                                    @ sw.js:68
//
// Die Adresse STAND in der Sicherheitsregel -- unter `script-src`, wo ein
// Skript hingehoert. Nur wurde sie nicht als Skript geladen: Der Service
// Worker hat die Anfrage uebernommen und als `fetch()` neu gestellt. Ein
// `fetch` aus einem Service Worker faellt unter `connect-src`. Dort stand
// sie nicht.
//
// Derselbe Mechanismus erklaert die beiden anderen blockierten Adressen
// (`cleardot.gif`, `127.0.0.1:8080`): Der Service Worker verwandelt JEDE
// Direktive in `connect-src`.
//
// ── WARUM DAS NICHT MIT EINER SUCHE NACH ZEICHENKETTEN GEPRUEFT WIRD ──────
// Ob im Quelltext irgendwo `self.location.origin` vorkommt, sagt nichts
// darueber, ob die Entscheidung stimmt. Deshalb loest dieses Skript die
// Funktion `sollAbfangen` aus public/sw.js heraus und FUEHRT SIE AUS -- mit
// einer Tabelle aus Faellen und erwarteten Antworten.
//
// `sollAbfangen` ist dafuer bewusst rein gehalten: vier Werte hinein, ein
// Wahrheitswert hinaus, kein Zugriff auf `self`, `caches` oder `Request`.
//
// Geprueft wird zusaetzlich, dass der fetch-Zuhoerer die Funktion auch
// BENUTZT und zwar VOR `event.respondWith`. Eine richtige Entscheidung, die
// niemand abfragt, aendert nichts.
//
// Aufruf:  node scripts/sw-durchreiche.mjs [Pfad]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const pfad = process.argv[2] || 'public/sw.js';
const quelle = readFileSync(pfad, 'utf8');

const fehler = [];

// ── 1. Die Funktion herausloesen ─────────────────────────────────────────
// Klammern zaehlen statt regulaerem Ausdruck: Der Rumpf enthaelt selbst
// geschweifte Klammern, und ein Ausdruck wuerde am ersten `}` abbrechen.
function funktionsQuelle(text, name) {
  const kopf = `function ${name}(`;
  const start = text.indexOf(kopf);
  if (start === -1) return null;
  const auf = text.indexOf('{', start);
  if (auf === -1) return null;
  let tiefe = 0;
  for (let i = auf; i < text.length; i++) {
    if (text[i] === '{') tiefe++;
    else if (text[i] === '}') {
      tiefe--;
      if (tiefe === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const abschnitt = funktionsQuelle(quelle, 'sollAbfangen');
if (!abschnitt) {
  console.error(`\nABBRUCH: In ${pfad} gibt es keine Funktion \`sollAbfangen\`.\n`);
  process.exit(1);
}

let sollAbfangen;
try {
  sollAbfangen = new Function(`${abschnitt}; return sollAbfangen;`)();
} catch (e) {
  console.error(`\nABBRUCH: \`sollAbfangen\` liess sich nicht auswerten: ${e.message}\n`);
  process.exit(1);
}

// ── 2. Die Faelle ────────────────────────────────────────────────────────
const EIGEN = 'http://localhost:3000';

const FAELLE = [
  { was: 'eigenes Bundle',
    ein: ['GET', EIGEN, EIGEN, 'cors'], soll: true },
  { was: 'eigenes Bild',
    ein: ['GET', EIGEN, EIGEN, 'no-cors'], soll: true },

  { was: 'das Dokument selbst (navigate)',
    ein: ['GET', EIGEN, EIGEN, 'navigate'], soll: false },

  { was: 'Google-Anmeldeskript apis.google.com',
    ein: ['GET', 'https://apis.google.com', EIGEN, 'no-cors'], soll: false },
  { was: 'Firestore-Emulator 127.0.0.1:8080',
    ein: ['GET', 'http://127.0.0.1:8080', EIGEN, 'cors'], soll: false },
  { was: 'cleardot.gif von www.google.com',
    ein: ['GET', 'https://www.google.com', EIGEN, 'no-cors'], soll: false },
  { was: 'identitytoolkit.googleapis.com',
    ein: ['GET', 'https://identitytoolkit.googleapis.com', EIGEN, 'cors'], soll: false },

  { was: 'eigenes POST (kein Rumpf-Abgleich moeglich)',
    ein: ['POST', EIGEN, EIGEN, 'cors'], soll: false },
  { was: 'fremdes POST',
    ein: ['POST', 'https://apis.google.com', EIGEN, 'cors'], soll: false },
  { was: 'fremde Navigation',
    ein: ['GET', 'https://apis.google.com', EIGEN, 'navigate'], soll: false },
];

for (const f of FAELLE) {
  const ist = sollAbfangen(...f.ein);
  if (ist !== f.soll) {
    fehler.push(`${f.was}: erwartet ${f.soll}, bekommen ${ist}  [${f.ein.join(' | ')}]`);
  }
}

// ── 3. Wird die Entscheidung ueberhaupt abgefragt? ───────────────────────
const zuhoerer = quelle.indexOf("addEventListener('fetch'");
const aufruf = quelle.indexOf('sollAbfangen(', zuhoerer === -1 ? 0 : zuhoerer);
const antwort = quelle.indexOf('event.respondWith', zuhoerer === -1 ? 0 : zuhoerer);

if (zuhoerer === -1) {
  fehler.push("kein fetch-Zuhoerer gefunden");
} else if (aufruf === -1) {
  fehler.push("der fetch-Zuhoerer ruft `sollAbfangen` nicht auf");
} else if (antwort === -1) {
  fehler.push("der fetch-Zuhoerer ruft `event.respondWith` nicht auf");
} else if (aufruf > antwort) {
  fehler.push("`sollAbfangen` wird ERST NACH `event.respondWith` abgefragt -- dann ist die Anfrage schon uebernommen");
}

// ── Ausgabe ──────────────────────────────────────────────────────────────
console.log(`\nService Worker, Durchreiche (${pfad}): ${FAELLE.length} Faelle geprueft, ${fehler.length} abweichend.\n`);

if (fehler.length === 0) {
  for (const f of FAELLE) console.log(`  ok    ${f.soll ? 'abfangen ' : 'durchlassen'}  ${f.was}`);
  console.log('');
  process.exit(0);
}

for (const z of fehler) console.log(`  FEHLER  ${z}`);
console.log(`
Ein \`fetch()\` AUS einem Service Worker faellt unter \`connect-src\` --
unabhaengig davon, wofuer das Ergebnis gedacht ist. Wer fremde Anfragen
uebernimmt, verschiebt damit jede Direktive nach \`connect-src\` und muss
jede Adresse doppelt eintragen. Vergisst er eine, faellt es erst im Betrieb
auf, und zwar als Fehler an ganz anderer Stelle -- hier war es
\`auth/internal-error\` bei der Google-Anmeldung.

Navigationsanfragen gehoeren aus demselben Grund nicht in den Speicher: Das
Dokument traegt die Sicherheitsregeln und die Verweise auf den aktuellen Bau.
`);
process.exit(1);
