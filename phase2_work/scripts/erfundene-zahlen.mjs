#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// `Math.random()` als DATENQUELLE.
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// `check:erfundene-diagramme` findet feste Zahlenreihen im Quelltext. Es
// findet NICHT den anderen Weg, eine Zahl zu erfinden: sie auswuerfeln.
//
// Der Befund vom 13.08.2026: `ConversationStatsWidget` zeichnete auf dem
// Dashboard ein 30-Tage-Diagramm — Gespraeche je Tag, Antwortrate — beides
// aus `Math.random()`. Ueberschrift: „Letzte 30 Tage". Bei jedem Neuladen
// ein anderer Verlauf. Fuer die bedienende Person nicht von einer Messung
// zu unterscheiden.
//
// ── NICHT JEDER ZUFALL IST ERFUNDEN ───────────────────────────────────────
// Drei Verwendungen sind in Ordnung, und zwar aus jeweils eigenem Grund:
//
//   1. ANIMATION — wo ein Schnipsel hinfliegt, behauptet nichts.
//   2. AUSWAHL AUS EINER FESTEN LISTE — welches von fuenf Zitaten erscheint,
//      ist eine Entscheidung, keine Messung. Die Liste ist echt.
//   3. KENNUNG — eine `id` fuer einen neuen Eintrag ist keine Aussage.
//
// Nicht in Ordnung ist die vierte: eine ZAHL, die als Beobachtung auftritt.
// Ein Verlauf, eine Quote, ein Wetter, ein Punktestand.
//
// ── WIE GEPRUEFT WIRD ─────────────────────────────────────────────────────
// Unten steht je Datei, wie viele Verwendungen dort ERLAUBT sind und warum.
// Gezaehlt wird alles darueber hinaus und alles in Dateien, die nicht
// aufgefuehrt sind. Damit faellt jede NEUE Verwendung auf, auch eine
// harmlose — dann gehoert sie mit einem Grund in die Tabelle.
//
// Das Skript kann den Grund nicht pruefen. Es haelt fest, dass es einen
// gibt, und wer ihn aufgeschrieben hat.
//
// Aufruf:  node scripts/erfundene-zahlen.mjs [Wurzel] [Obergrenze]
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] || 'src';
const obergrenze = Number(process.argv[3] ?? 0);

/**
 * Zusaetzlich geprueft, ausserhalb der Wurzel.
 *
 * BEFUND 14.08.2026: `server.ts` liegt neben `src` und wurde deshalb NIE
 * geprueft. Darin stand eine 7-Tage-Latenzreihe aus
 * `120 + Math.random() * 80 + (i === 4 ? 150 : 0)` — erfundene Zahlen mit
 * absichtlich eingebautem Ausschlag, ausgeliefert ueber `/api/system-health`.
 *
 * Aufgefallen ist sie beim Lesen, nicht durch diese Pruefung. Eine Pruefung,
 * die einen Ort nicht ansieht, meldet dort auch nichts — und sieht dabei aus
 * wie „alles gruen". Derselbe Mechanismus wie bei `verify`, das den Bau nie
 * ausgefuehrt hat.
 */
const ZUSAETZLICH = ['server.ts'];

/** Datei -> { anzahl, grund }. `anzahl` ist die Zahl der erlaubten Stellen. */
const ERLAUBT = {
  'src/components/Confetti.tsx':
    { anzahl: 8, grund: 'Animation: Lage, Farbe, Groesse, Drehung und Dauer der Schnipsel' },
  'src/components/CoachParticles.tsx':
    { anzahl: 3, grund: 'Animation: Lage und Groesse der Punkte' },

  'src/components/DatingTimelineWidget.tsx':
    { anzahl: 1, grund: 'Auswahl aus einer festen Fragenliste' },
  'src/components/DatingWheelWidget.tsx':
    { anzahl: 1, grund: 'Auswahl aus einer festen Ideenliste' },
  'src/components/DatingDuelWidget.tsx':
    { anzahl: 1, grund: 'Auswahl aus einer festen Duellliste' },
  'src/components/UpcomingDateWidget.tsx':
    { anzahl: 1, grund: 'Auswahl aus einer festen Zitatliste' },
  'src/services/notificationService.ts':
    { anzahl: 1, grund: 'Auswahl aus einer festen Impulsliste' },
  'src/server/klarCore.ts':
    { anzahl: 1, grund: 'Auswahl der Verifizierungsgeste — hier IST der Zufall die Anforderung; die Zahl wird in `waehleGeste()` hineingereicht und ist dadurch pruefbar' },

  'src/components/DateArchiveWidget.tsx':
    { anzahl: 1, grund: 'Kennung fuer einen neuen Eintrag' },
  'src/screens/AICoach.tsx':
    { anzahl: 1, grund: 'Kennung fuer eine neue Nachricht' },

  'src/components/ProfileCheckWidget.tsx':
    { anzahl: 2, grund: 'Auswahl aus einer festen Tippliste, und eine Kennung' },
  'src/components/MoodDiaryWidget.tsx':
    { anzahl: 1, grund: 'Kennung fuer einen neuen Eintrag — die ZWEITE Stelle in dieser Datei ist eine erfundene Grundlinie und wird gezaehlt' },
};

// ── KOMMENTARE ENTFERNEN, ZEICHENWEISE ───────────────────────────────────
// Hier stand frueher ein regulaerer Ausdruck fuer Blockkommentare. Er hat
// funktioniert, solange nur Dateien unter `src` geprueft wurden. Mit
// `server.ts` kam er an seine Grenze: Dort steht
//
//     "https://*.googleapis.com"
//
// und darin stecken die Zeichen Schraegstrich, Schraegstrich, Stern — also
// der Anfang eines Blockkommentars. Der Ausdruck hat ihn dafuer gehalten und
// alles bis zum naechsten Kommentarende verschluckt. Nach der Entfernung war
// die halbe Datei leer, und die Pruefung meldete 0 Treffer, ohne rot zu
// werden.
//
// Dieselbe Falle ist in `formularfelder.mjs` („eine naive Suche uebersah 57
// von 90 Faellen") und in `routen-inventar.mjs` schon einmal beschrieben.
// Sie wiederholt sich, weil ein regulaerer Ausdruck den Unterschied zwischen
// Code und Zeichenkette nicht kennt.
//
// Diese Fassung laeuft Zeichen fuer Zeichen und weiss, ob sie gerade in
// einer Zeichenkette steht. Kommentare werden durch Leerzeichen ersetzt,
// damit die Zeilennummern erhalten bleiben.
function ohneKommentare(s) {
  let aus = '';
  let i = 0;
  let anfuehrung = null;
  while (i < s.length) {
    const z = s[i];
    const naechst = s[i + 1];

    if (anfuehrung) {
      if (z === '\\') { aus += s.slice(i, i + 2); i += 2; continue; }
      if (z === anfuehrung) anfuehrung = null;
      aus += z; i++; continue;
    }

    if (z === '"' || z === "'" || z === '`') { anfuehrung = z; aus += z; i++; continue; }

    if (z === '/' && naechst === '/') {
      while (i < s.length && s[i] !== '\n') { aus += ' '; i++; }
      continue;
    }
    if (z === '/' && naechst === '*') {
      const ende = s.indexOf('*' + '/', i + 2);
      const bis = ende === -1 ? s.length : ende + 2;
      for (let k = i; k < bis; k++) aus += s[k] === '\n' ? '\n' : ' ';
      i = bis; continue;
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

const treffer = [];
let gesamt = 0;

for (const datei of [...dateien(wurzel), ...ZUSAETZLICH.filter((d) => existsSync(d))]) {
  const text = ohneKommentare(readFileSync(datei, 'utf8'));
  const zeilen = text.split('\n');
  const stellen = [];
  zeilen.forEach((z, i) => {
    for (let k = 0; k < (z.match(/Math\.random/g) || []).length; k++) stellen.push(i + 1);
  });
  if (stellen.length === 0) continue;

  const eintrag = ERLAUBT[datei.split('\\').join('/')];
  const erlaubt = eintrag ? eintrag.anzahl : 0;
  gesamt += stellen.length;
  const ueber = stellen.length - erlaubt;
  if (ueber > 0) treffer.push({ datei, gesamt: stellen.length, erlaubt, ueber, stellen });
}

const gezaehlt = treffer.reduce((s, t) => s + t.ueber, 0);

console.log(`\n\`Math.random()\` als Datenquelle: ${gezaehlt} Stelle(n) in ${treffer.length} Datei(en) — erlaubt sind ${obergrenze}.`);
console.log(`(${gesamt} Verwendungen insgesamt; ${gesamt - gezaehlt} davon mit hinterlegtem Grund.)\n`);

for (const t of treffer.sort((a, b) => b.ueber - a.ueber)) {
  const zusatz = t.erlaubt > 0 ? `  (${t.erlaubt} davon mit Grund)` : '';
  console.log(`  ${String(t.ueber).padStart(3)}  ${t.datei}${zusatz}`);
  console.log(`         Zeile(n) ${t.stellen.join(', ')}`);
}

if (gezaehlt > obergrenze) {
  console.log(`
Eine ausgewuerfelte Zahl, die als Beobachtung auftritt, ist erfunden — auch
wenn sie plausibel aussieht. Entweder sie kommt aus erhobenen Daten, oder
die Anzeige entfaellt. Ein Hinweis „Demodaten", den man wegklickt, macht die
Zahl nicht wahr.

Ist die Verwendung Animation, Auswahl aus einer festen Liste oder eine
Kennung, gehoert sie mit einem Grund in die Tabelle ERLAUBT in
scripts/erfundene-zahlen.mjs.
`);
  process.exit(1);
}
console.log('');
