#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Sind alle noetigen CSP-Direktiven ueberhaupt gesetzt?
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Auf dem Profil-Bildschirm, im gebauten Stand gemessen:
//
//   Creating a worker from 'blob:http://localhost:3000/8ddb37c5-…' violates
//   the following Content Security Policy directive:
//   "script-src 'self' https://apis.google.com". Note that 'worker-src' was
//   NOT EXPLICITLY SET, so 'script-src' is used as a fallback.
//   The action has been blocked.
//
// Das ist die tueckische Sorte: Eine FEHLENDE Direktive faellt nicht auf.
// Die CSP sieht vollstaendig aus, es steht ja ueberall etwas. Nur greift
// dann eine andere Direktive als Rueckfall — und die ist fuer den Fall nie
// gedacht gewesen.
//
// Dieselbe Klasse wie `erfundene-zahlen.mjs`, das `server.ts` nie angesehen
// hat: Eine Pruefung, die einen Ort nicht ansieht, meldet dort auch nichts.
// Hier ist es der Browser, der einen Ort nicht ansieht.
//
// ── WAS GEPRUEFT WIRD ─────────────────────────────────────────────────────
// Nur, DASS die Direktive vorkommt — nicht, was drinsteht. Der Inhalt ist
// eine Entscheidung mit Begruendung; das Vorhandensein ist es nicht.
//
// Aufruf:  node scripts/csp-direktiven.mjs [Datei]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const datei = process.argv[2] || 'server.ts';

/** Direktive -> warum sie gebraucht wird. Der Grund steht im Bericht. */
const NOETIG = {
  defaultSrc: 'Rueckfall fuer alles, was unten nicht steht',
  scriptSrc: 'Skripte — hier liegt das eigentliche Risiko',
  styleSrc: 'Stile',
  fontSrc: 'Schriften',
  imgSrc: 'Bilder',
  connectSrc: 'fetch, XHR, WebSocket',
  frameSrc: 'eingebettete Rahmen — u. a. der Anmeldedialog von Firebase',
  workerSrc: 'Web Worker. FEHLTE bis 14.08.2026; ohne sie greift scriptSrc, und `blob:` ist dort verboten',
  objectSrc: 'Einbettungen — gehoert auf none',
  baseUri: 'verhindert das Umbiegen relativer Adressen',
  formAction: 'wohin Formulare abgeschickt werden duerfen',
  frameAncestors: 'wer UNS einbetten darf — Schutz vor Clickjacking',
};

function ohneKommentare(text) {
  return text
    .split('\n')
    .map((z) => {
      const i = z.indexOf('//');
      return i === -1 ? z : z.slice(0, i);
    })
    .join('\n');
}

const quelle = ohneKommentare(readFileSync(datei, 'utf8'));

const fehlend = [];
const vorhanden = [];
for (const [name, grund] of Object.entries(NOETIG)) {
  // `workerSrc:` als Schluessel im Direktiven-Objekt.
  if (new RegExp(`\\b${name}\\s*:`).test(quelle)) vorhanden.push(name);
  else fehlend.push({ name, grund });
}

console.log(`\nCSP-Direktiven in ${datei}: ${vorhanden.length} von ${Object.keys(NOETIG).length} gesetzt.\n`);

for (const f of fehlend) {
  console.log(`  FEHLT  ${f.name}`);
  console.log(`         ${f.grund}`);
}

if (fehlend.length > 0) {
  console.log(`
Eine fehlende Direktive faellt im Betrieb nicht auf: Der Browser nimmt
stillschweigend eine andere als Rueckfall. Erst eine blockierte Anfrage in der
Konsole verraet es — und die sieht niemand, weil die CSP nur in der Produktion
gilt.

Jede Direktive gehoert ausdruecklich gesetzt, auch wenn ihr Wert derselbe ist
wie der des Rueckfalls. Dann steht die Entscheidung im Code statt im Kopf.
`);
  process.exit(1);
}

console.log('  alle gesetzt\n');
