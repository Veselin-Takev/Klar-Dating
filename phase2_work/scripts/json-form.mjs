#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Prüft, dass jeder KI-Endpunkt sagt, in welcher FORM er antwortet.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `/api/profile-summary` antwortete zuverlässig mit HTTP 502 „Das Ergebnis
// war unbrauchbar". Die Ursache lag nicht bei Gemini:
//
//   `beantworte(endpunkt, aufruf, beiwerk = {})` parst die Antwort als JSON,
//   solange nicht `json: false` gesetzt ist. `/api/profile-summary` wurde
//   beim Umbau am 12.08.2026 OHNE Beiwerk umgestellt — die Systemanweisung
//   verlangt aber Fliesstext („max 3 Sätze"), und im Aufruf steht kein
//   `responseMimeType: "application/json"`.
//
// Ergebnis: Das Modell liefert Prosa, `JSON.parse` scheitert, `beantworte`
// entscheidet auf `ki_ungueltig`, und der Endpunkt konnte seit dem Umbau
// KEIN EINZIGES MAL erfolgreich antworten.
//
// Aufgefallen ist es erst im laufenden Betrieb. Kein Test hat es gefunden,
// weil es keinen gibt — genau die Lücke, die die Endpunkttests schliessen
// sollen.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Ein `beantworte`-Aufruf muss die Form seiner Antwort festlegen, und zwar
// auf genau eine von zwei Arten:
//
//   · `json: false` im Beiwerk  -> Fliesstext, wird unter `feld` abgelegt
//   · `responseMimeType` im Aufruf -> JSON, wird geparst
//
// Fehlt beides, ist der Endpunkt im JSON-Modus, ohne dass jemand JSON
// verlangt hat. Das kann nur schiefgehen.
//
// ── GRENZE DIESER PRÜFUNG ─────────────────────────────────────────────────
// Sie liest Text, nicht Bedeutung. Ein Endpunkt mit `responseMimeType`, der
// trotzdem ein falsches Schema hat, fällt hier nicht auf — dafür braucht es
// einen Endpunkttest.
//
// Aufruf:  node scripts/json-form.mjs [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const obergrenze = Number(process.argv[2] ?? 0);

const roh = readFileSync('server.ts', 'utf8');
// Kommentare zu Leerzeichen, Zeilennummern bleiben erhalten.
const text = roh
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, (_m, vor) => vor);

/** Ende eines Klammerausdrucks ab der öffnenden Klammer. Zählt Klammern und
 *  überspringt Zeichenketten — dieselbe Vorsicht wie in
 *  `check-beschriftung.mjs`, wo eine naive Suche 57 von 90 Fällen übersah. */
function klammerEnde(t, start) {
  let i = start, tiefe = 0, anfuehrung = null;
  while (i < t.length) {
    const z = t[i];
    if (anfuehrung) {
      if (z === '\\') { i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      i++; continue;
    }
    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; i++; continue; }
    if (z === '(') { tiefe++; i++; continue; }
    if (z === ')') { tiefe--; if (tiefe === 0) return i; i++; continue; }
    i++;
  }
  return -1;
}

const zeileVon = (pos) => text.slice(0, pos).split('\n').length;

const jsonModus = [];
const freitext = [];
const ohneForm = [];

const re = /await\s+beantworte\s*\(/g;
let m;
while ((m = re.exec(text)) !== null) {
  const auf = text.indexOf('(', m.index);
  const zu = klammerEnde(text, auf);
  if (zu === -1) continue;
  const arg = text.slice(auf, zu);
  const pfad = (arg.match(/["'`](\/api\/[^"'`]+)["'`]/) || [])[1] || '(unbekannt)';
  const eintrag = { pfad, zeile: zeileVon(m.index) };

  if (/json:\s*false/.test(arg)) freitext.push(eintrag);
  else if (/responseMimeType/.test(arg)) jsonModus.push(eintrag);
  else ohneForm.push(eintrag);
}

const gesamt = jsonModus.length + freitext.length + ohneForm.length;
console.log(`\nKI-Endpunkte über beantworte(): ${gesamt}\n`);
console.log(`  JSON mit responseMimeType:        ${String(jsonModus.length).padStart(3)}`);
console.log(`  Freitext (json: false):           ${String(freitext.length).padStart(3)}`);
console.log(`  ohne Formfestlegung:              ${String(ohneForm.length).padStart(3)}  — erlaubt sind ${obergrenze}`);

if (ohneForm.length > 0) {
  console.log('\n── ohne Formfestlegung: scheitert immer mit ki_ungueltig (HTTP 502) ──');
  for (const e of ohneForm) console.log(`  ${String(e.zeile).padStart(5)}  ${e.pfad}`);
  console.log(`
Entweder `+'`json: false`'+` ins Beiwerk (mit `+'`feld`'+`, unter dem der Text landet),
oder `+'`responseMimeType: "application/json"`'+` samt Schema in den Aufruf.
`);
}

if (ohneForm.length > obergrenze) process.exit(1);
console.log('');
